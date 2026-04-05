import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities';
import { JwtService } from '@nestjs/jwt';
import { IdUtil } from '@/common/utils/id.util';
import { CryptoUtil } from '@/common/utils/crypto.util';

/**
 * 微信登录服务
 * 文档：https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_webpage_authorization.html
 */
@Injectable()
export class WechatService {
  private appId: string;
  private appSecret: string;
  private loginAppId: string;
  private loginAppSecret: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
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

    let isNewUser = false;

    if (!user) {
      // 创建新用户（临时用户，需要绑定手机号）
      isNewUser = true;
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
  async bindPhone(tempToken: string, phone: string, code: string): Promise<{ token: string; user: any }> {
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
    const data = await response.json() as any;

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
    const data = await response.json() as any;

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
      const tokenData = await tokenResponse.json() as any;

      if (tokenData.errcode) {
        throw new BadRequestException('获取access_token失败');
      }

      accessToken = tokenData.access_token;
      await this.redisService.set('wechat:jsapi:access_token', accessToken!, 7000);
    }

    // 获取jsapi_ticket
    let ticket = await this.redisService.get('wechat:jsapi:ticket');
    if (!ticket) {
      const ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
      const ticketResponse = await fetch(ticketUrl);
      const ticketData = await ticketResponse.json() as any;

      if (ticketData.errcode !== 0) {
        throw new BadRequestException('获取jsapi_ticket失败');
      }

      ticket = ticketData.ticket;
      await this.redisService.set('wechat:jsapi:ticket', ticket!, 7000);
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
    const { password, ...result } = user;
    return result;
  }
}
