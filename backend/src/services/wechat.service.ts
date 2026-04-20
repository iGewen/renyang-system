import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SystemConfig } from '@/entities';
import { JwtService } from '@nestjs/jwt';
import { IdUtil } from '@/common/utils/id.util';
import { CryptoUtil } from '@/common/utils/crypto.util';

/**
 * 微信登录服务
 * 文档：https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html
 */
@Injectable()
export class WechatService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly loginAppId: string;
  private readonly loginAppSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly jwtService: JwtService,
  ) {
    // 微信支付相关
    this.appId = this.configService.get('wechat.appId') || '';
    this.appSecret = this.configService.get('wechat.appSecret') || '';
    // 微信登录相关（公众号）
    this.loginAppId = this.configService.get('wechatLogin.appId') || '';
    this.loginAppSecret = this.configService.get('wechatLogin.appSecret') || '';
  }

  /**
   * 获取微信授权URL（公众号网页授权）
   */
  async getAuthUrl(redirectUri: string, state?: string): Promise<{ url: string }> {
    const appId = this.loginAppId || this.appId;
    if (!appId) {
      throw new BadRequestException('微信登录未配置');
    }

    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const stateValue = state || CryptoUtil.randomString(16);

    // 存储state用于验证
    await this.redisService.set(`wechat:state:${stateValue}`, '1', 600); // 10分钟有效

    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodedRedirectUri}&response_type=code&scope=snsapi_userinfo&state=${stateValue}#wechat_redirect`;

    return { url };
  }

  /**
   * 微信授权回调处理
   */
  async handleCallback(code: string, state: string): Promise<{ token: string; user: any; isNewUser: boolean }> {
    // 验证state
    const stateKey = `wechat:state:${state}`;
    const stateExists = await this.redisService.get(stateKey);
    if (!stateExists) {
      throw new BadRequestException('授权已过期，请重新授权');
    }
    await this.redisService.del(stateKey);

    // 获取access_token
    const tokenData = await this.getAccessToken(code);

    // 获取用户信息
    const userInfo = await this.getUserInfo(tokenData.access_token, tokenData.openid);

    // 查找或创建用户
    let user = await this.userRepository.findOne({
      where: { wechatOpenId: tokenData.openid },
    });

    if (!user) {
      // 创建新用户（临时用户，需要绑定手机号）
      user = this.userRepository.create({
        id: IdUtil.generate('U'),
        wechatOpenId: tokenData.openid,
        wechatUnionId: tokenData.unionid,
        nickname: userInfo.nickname || `微信用户${userInfo.openid.slice(-6)}`,
        avatar: userInfo.headimgurl,
        balance: 0,
        status: 1,
      });
      await this.userRepository.save(user);

      // 生成临时token用于绑定手机号
      const tempToken = CryptoUtil.randomString(32);
      await this.redisService.set(`wechat:temp:${tempToken}`, JSON.stringify({
        userId: user.id,
        openid: tokenData.openid,
        unionid: tokenData.unionid,
        userInfo,
      }), 1800); // 30分钟有效

      return {
        token: tempToken,
        user: this.sanitizeUser(user),
        isNewUser: true,
      };
    }

    // 更新用户信息
    if (userInfo.nickname) {
      user.nickname = userInfo.nickname;
    }
    if (userInfo.headimgurl) {
      user.avatar = userInfo.headimgurl;
    }
    await this.userRepository.save(user);

    // 生成JWT token
    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user),
      isNewUser: false,
    };
  }

  /**
   * 绑定手机号
   */
  async bindPhone(tempToken: string, phone: string, _code: string): Promise<{ token: string; user: any }> {
    // 验证临时token
    const tempData = await this.redisService.get(`wechat:temp:${tempToken}`);
    if (!tempData) {
      throw new BadRequestException('临时token已过期，请重新授权');
    }

    const userData = JSON.parse(tempData);

    // 检查手机号是否已注册
    let user = await this.userRepository.findOne({ where: { phone } });

    if (user) {
      // 手机号已注册，绑定微信
      user.wechatOpenId = userData.openid;
      user.wechatUnionId = userData.unionid;
      await this.userRepository.save(user);
    } else {
      // 创建新用户
      user = this.userRepository.create({
        id: userData.userId || IdUtil.generate('U'),
        phone,
        wechatOpenId: userData.openid,
        wechatUnionId: userData.unionid,
        nickname: userData.userInfo?.nickname || `用户${phone.slice(-4)}`,
        avatar: userData.userInfo?.headimgurl,
        balance: 0,
        status: 1,
      });
      await this.userRepository.save(user);
    }

    // 删除临时token
    await this.redisService.del(`wechat:temp:${tempToken}`);

    // 生成JWT token
    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 获取access_token
   */
  private async getAccessToken(code: string): Promise<{ access_token: string; openid: string; unionid?: string }> {
    const appId = this.loginAppId || this.appId;
    const appSecret = this.loginAppSecret || this.appSecret;

    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      throw new BadRequestException(data.errmsg || '获取微信授权失败');
    }

    return {
      access_token: data.access_token,
      openid: data.openid,
      unionid: data.unionid,
    };
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(accessToken: string, openid: string): Promise<any> {
    const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      // 如果获取失败，返回默认信息
      return {
        openid,
        nickname: '',
        headimgurl: '',
      };
    }

    return data;
  }

  /**
   * 获取微信JS-SDK签名
   */
  async getJsApiSignature(url: string): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
    const appId = this.loginAppId || this.appId;
    const appSecret = this.loginAppSecret || this.appSecret;

    // 获取access_token
    let accessToken = await this.redisService.get('wechat:jsapi:access_token');
    if (!accessToken) {
      const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      const tokenResponse = await fetch(tokenUrl);
      const tokenData = await tokenResponse.json();

      if (tokenData.errcode) {
        throw new BadRequestException('获取access_token失败');
      }

      accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new BadRequestException('获取access_token失败：返回值为空');
      }
      await this.redisService.set('wechat:jsapi:access_token', accessToken, 7000);
    }

    // 获取jsapi_ticket
    let ticket = await this.redisService.get('wechat:jsapi:ticket');
    if (!ticket) {
      const ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
      const ticketResponse = await fetch(ticketUrl);
      const ticketData = await ticketResponse.json();

      if (ticketData.errcode !== 0) {
        throw new BadRequestException('获取jsapi_ticket失败');
      }

      ticket = ticketData.ticket;
      if (!ticket) {
        throw new BadRequestException('获取jsapi_ticket失败：返回值为空');
      }
      await this.redisService.set('wechat:jsapi:ticket', ticket, 7000);
    }

    // 生成签名
    const nonceStr = CryptoUtil.randomString(16);
    const timestamp = Math.floor(Date.now() / 1000);

    const string1 = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;

    // SHA1签名
    const signature = await this.sha1(string1);

    return {
      appId,
      timestamp,
      nonceStr,
      signature,
    };
  }

  /**
   * SHA1哈希
   */
  private async sha1(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 生成JWT Token
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      type: 'user',
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 移除敏感信息
   */
  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  // ==================== 模板消息通知 ====================

  /**
   * 获取全局access_token（用于发送模板消息等）
   */
  private async getGlobalAccessToken(): Promise<string> {
    const appId = this.loginAppId || this.appId;
    const appSecret = this.loginAppSecret || this.appSecret;

    // 先从缓存获取
    let accessToken = await this.redisService.get('wechat:global:access_token');
    if (accessToken) {
      return accessToken;
    }

    // 重新获取
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      console.error('获取微信access_token失败:', data);
      throw new BadRequestException('获取微信access_token失败: ' + data.errmsg);
    }

    accessToken = data.access_token;
    // 缓存7000秒（约2小时，微信token有效期2小时）
    await this.redisService.set('wechat:global:access_token', accessToken as string, 7000);

    return accessToken as string;
  }

  /**
   * 发送模板消息
   * @param openid 用户openid
   * @param templateId 模板ID
   * @param data 模板数据
   * @param page 跳转页面（可选）
   */
  async sendTemplateMessage(
    openid: string,
    templateId: string,
    data: Record<string, { value: string; color?: string }>,
    page?: string,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getGlobalAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;

      const body: any = {
        touser: openid,
        template_id: templateId,
        data,
      };

      if (page) {
        body.url = page;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.errcode !== 0) {
        console.error('发送模板消息失败:', result);
        return false;
      }

      return true;
    } catch (error) {
      console.error('发送模板消息异常:', error);
      return false;
    }
  }

  /**
   * 发送领养成功通知
   */
  async sendAdoptionSuccessNotice(params: {
    openid: string;
    orderNo: string;
    livestockName: string;
    amount: number;
    time: string;
  }): Promise<boolean> {
    // 模板ID需要从配置或数据库获取
    const templateId = await this.getTemplateId('adoption_success');
    if (!templateId) {
      console.warn('领养成功通知模板未配置');
      return false;
    }

    return this.sendTemplateMessage(
      params.openid,
      templateId,
      {
        first: { value: '恭喜您，领养成功！' },
        keyword1: { value: params.orderNo },
        keyword2: { value: params.livestockName },
        keyword3: { value: `¥${params.amount.toFixed(2)}` },
        keyword4: { value: params.time },
        remark: { value: '感谢您的信任，我们将用心照料您的爱宠！' },
      },
      '/pages/adoption/index',
    );
  }

  /**
   * 发送饲料费账单通知
   */
  async sendFeedBillNotice(params: {
    openid: string;
    billMonth: string;
    livestockName: string;
    amount: number;
    deadline: string;
  }): Promise<boolean> {
    const templateId = await this.getTemplateId('feed_bill');
    if (!templateId) {
      console.warn('饲料费账单模板未配置');
      return false;
    }

    return this.sendTemplateMessage(
      params.openid,
      templateId,
      {
        first: { value: '您的饲料费账单已生成，请及时缴纳。' },
        keyword1: { value: params.billMonth },
        keyword2: { value: params.livestockName },
        keyword3: { value: `¥${params.amount.toFixed(2)}` },
        keyword4: { value: params.deadline },
        remark: { value: '逾期将产生滞纳金，请尽快缴纳。' },
      },
      '/pages/feed-bill/index',
    );
  }

  /**
   * 发送饲料费逾期提醒
   */
  async sendFeedBillOverdueNotice(params: {
    openid: string;
    billMonth: string;
    livestockName: string;
    amount: number;
    overdueDays: number;
    lateFee: number;
  }): Promise<boolean> {
    const templateId = await this.getTemplateId('feed_bill_overdue');
    if (!templateId) {
      console.warn('饲料费逾期模板未配置');
      return false;
    }

    return this.sendTemplateMessage(
      params.openid,
      templateId,
      {
        first: { value: '您的饲料费已逾期，请尽快缴纳！' },
        keyword1: { value: params.billMonth },
        keyword2: { value: `¥${params.amount.toFixed(2)}` },
        keyword3: { value: `${params.overdueDays}天` },
        keyword4: { value: `¥${params.lateFee.toFixed(2)}` },
        remark: { value: '请尽快缴纳以免影响您的领养权益。' },
      },
      '/pages/feed-bill/index',
    );
  }

  /**
   * 发送买断审核结果通知
   */
  async sendRedemptionAuditNotice(params: {
    openid: string;
    redemptionNo: string;
    livestockName: string;
    approved: boolean;
    amount?: number;
    remark?: string;
  }): Promise<boolean> {
    const templateId = await this.getTemplateId('redemption_audit');
    if (!templateId) {
      console.warn('买断审核模板未配置');
      return false;
    }

    return this.sendTemplateMessage(
      params.openid,
      templateId,
      {
        first: { value: params.approved ? '您的买断申请已通过审核！' : '您的买断申请未通过审核' },
        keyword1: { value: params.redemptionNo },
        keyword2: { value: params.livestockName },
        keyword3: { value: params.approved ? '审核通过' : '审核拒绝' },
        keyword4: { value: params.amount ? `¥${params.amount.toFixed(2)}` : '-' },
        remark: { value: params.remark || (params.approved ? '请尽快完成支付。' : '如有疑问请联系客服。') },
      },
      '/pages/redemption/index',
    );
  }

  /**
   * 发送买断成功通知
   */
  async sendRedemptionSuccessNotice(params: {
    openid: string;
    redemptionNo: string;
    livestockName: string;
    amount: number;
    time: string;
  }): Promise<boolean> {
    const templateId = await this.getTemplateId('redemption_success');
    if (!templateId) {
      console.warn('买断成功模板未配置');
      return false;
    }

    return this.sendTemplateMessage(
      params.openid,
      templateId,
      {
        first: { value: '恭喜您，买断成功！' },
        keyword1: { value: params.redemptionNo },
        keyword2: { value: params.livestockName },
        keyword3: { value: `¥${params.amount.toFixed(2)}` },
        keyword4: { value: params.time },
        remark: { value: '感谢您的支持，我们会继续提供优质服务！' },
      },
    );
  }

  /**
   * 从数据库获取模板ID
   */
  private async getTemplateId(templateKey: string): Promise<string | null> {
    // 从Redis缓存获取
    const cacheKey = `wechat:template:${templateKey}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 从数据库获取
    const configKey = `wechat_template_${templateKey}`;
    const config = await this.systemConfigRepository.findOne({
      where: { configKey },
    });

    if (config?.configValue) {
      // 缓存1小时
      await this.redisService.set(cacheKey, config.configValue, 3600);
      return config.configValue;
    }

    return null;
  }
}
