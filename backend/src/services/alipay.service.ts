import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { SystemConfig } from '@/entities';
import * as crypto from 'node:crypto';

/**
 * 支付宝支付服务
 * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay
 * 使用支付宝开放平台SDK的签名方式（非官方SDK，自行实现签名）
 */
@Injectable()
export class AlipayService {
  private notifyUrl: string;
  private returnUrl: string;
  private gateway: string = 'https://openapi.alipay.com/gateway.do';
  private readonly logger = new Logger(AlipayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
  ) {
    this.notifyUrl = this.configService.get('alipay.notifyUrl') || '';
    this.returnUrl = this.configService.get('alipay.returnUrl') || '';
  }

  /**
   * 从数据库获取配置
   */
  private async getConfig(key: string): Promise<string> {
    // 先从缓存获取
    const cacheKey = `config:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 从数据库获取
    const config = await this.configRepository.findOne({
      where: { configKey: key },
    });

    const value = config?.configValue || '';
    // 缓存5分钟
    await this.redisService.set(cacheKey, value, 300);
    return value;
  }

  /**
   * 创建H5支付
   * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay
   */
  async createH5Payment(
    outTradeNo: string,
    totalAmount: number,
    subject: string,
    body?: string,
  ): Promise<{ payUrl: string }> {
    // 从数据库获取配置
    const appId = await this.getConfig('alipay_app_id');
    const privateKey = await this.getConfig('alipay_private_key');
    const notifyUrl = await this.getConfig('alipay_notify_url') || this.notifyUrl;
    const returnUrl = await this.getConfig('alipay_return_url') || this.returnUrl;

    // 检查必要配置
    if (!appId || !privateKey) {
      this.logger.error('[Alipay] 支付宝未配置，请在后台配置支付宝参数');
      throw new BadRequestException('支付宝未配置，请联系管理员配置支付宝参数');
    }

    this.logger.log(`[Alipay] 创建H5支付 - 订单号: ${outTradeNo}, 金额: ${totalAmount}, AppId: ${appId}`);

    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: totalAmount.toFixed(2),
      subject,
      body: body || subject,
      product_code: 'QUICK_WAP_WAY',
      // H5支付场景信息
      scene_info: {
        type: 'Wap',
        wap_url: returnUrl,
        wap_name: '云端牧场',
      },
    };

    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.wap.pay',
      format: 'JSON',
      return_url: returnUrl,
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      notify_url: notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // 签名
    params.sign = this.sign(params, privateKey);

    // 构建支付URL
    const payUrl = `${this.gateway}?${this.buildQueryString(params)}`;

    this.logger.log(`[Alipay] 生成支付URL: ${payUrl.substring(0, 200)}...`);

    return { payUrl };
  }

  /**
   * 验证回调签名
   * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay
   * 安全修复：公钥未配置时安全失败，不再绕过验证
   * 安全修复：添加 app_id 验证和 notify_id 防重放检查
   */
  async verifyNotify(params: Record<string, string>): Promise<boolean> {
    const alipayPublicKey = await this.getConfig('alipay_public_key');
    const expectedAppId = await this.getConfig('alipay_app_id');

    // 安全修复：公钥未配置时，拒绝验签而非绕过
    if (!alipayPublicKey) {
      this.logger.error('[Alipay] 支付宝公钥未配置，拒绝验签');
      return false;
    }

    // 安全修复：验证 app_id 是否匹配
    if (expectedAppId && params.app_id !== expectedAppId) {
      this.logger.error('[Alipay] app_id 不匹配', {
        expected: expectedAppId,
        received: params.app_id,
      });
      return false;
    }

    // 安全修复：防重放攻击 - 检查 notify_id 是否已处理
    const notifyId = params.notify_id;
    if (notifyId) {
      const processedKey = `alipay:notify:${notifyId}`;
      const isProcessed = await this.redisService.exists(processedKey);
      if (isProcessed) {
        this.logger.warn('[Alipay] 重复的回调通知', { notifyId });
        return false;
      }
    }

    const sign = params.sign;

    if (!sign) {
      this.logger.error('[Alipay] 回调缺少签名');
      return false;
    }

    // 移除sign和sign_type
    const { sign: _, sign_type: __, ...data } = params;

    // 排序并构建待签名字符串
    const signData = Object.keys(data)
      .filter((key) => data[key] !== '' && data[key] !== undefined)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signData);

      // 格式化公钥
      const publicKey = this.formatPublicKey(alipayPublicKey);

      const result = verify.verify(publicKey, sign, 'base64');

      if (!result) {
        this.logger.error('[Alipay] 验签失败', { signData: signData.substring(0, 100) });
      } else {
        // 验签成功，标记 notify_id 为已处理（24小时）
        if (notifyId) {
          await this.redisService.set(`alipay:notify:${notifyId}`, '1', 86400);
        }
      }

      return result;
    } catch (error) {
      this.logger.error('[Alipay] 验签异常:', error);
      return false;
    }
  }

  /**
   * 查询订单
   * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.query
   * 安全修复：配置缺失时抛出异常，不返回模拟数据
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    const appId = await this.getConfig('alipay_app_id');
    const privateKey = await this.getConfig('alipay_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !privateKey) {
      this.logger.error('[Alipay] 支付宝配置缺失，无法查询订单');
      throw new BadRequestException('支付宝配置不完整，请联系管理员');
    }

    const bizContent = {
      out_trade_no: outTradeNo,
    };

    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.query',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params, privateKey);

    try {
      const response = await fetch(this.gateway, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: this.buildQueryString(params),
      });

      const result = await response.json();
      this.logger.log(`[Alipay] 查询订单响应: ${JSON.stringify(result.alipay_trade_query_response || result)}`);

      return result.alipay_trade_query_response;
    } catch (error) {
      this.logger.error('[Alipay] 查询订单失败:', error);
      throw new BadRequestException('查询订单失败');
    }
  }

  /**
   * 关闭订单
   * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.close
   * 安全修复：配置缺失时抛出异常
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    const appId = await this.getConfig('alipay_app_id');
    const privateKey = await this.getConfig('alipay_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !privateKey) {
      this.logger.error('[Alipay] 支付宝配置缺失，无法关闭订单');
      throw new BadRequestException('支付宝配置不完整，请联系管理员');
    }

    const bizContent = {
      out_trade_no: outTradeNo,
    };

    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.close',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params, privateKey);

    try {
      const response = await fetch(this.gateway, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: this.buildQueryString(params),
      });

      const result = await response.json();
      this.logger.log(`[Alipay] 关闭订单响应: ${JSON.stringify(result.alipay_trade_close_response || result)}`);

      return result.alipay_trade_close_response?.code === '10000';
    } catch (error) {
      this.logger.error('[Alipay] 关闭订单失败:', error);
      return false;
    }
  }

  /**
   * 退款
   * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.refund
   * 安全修复：配置缺失时抛出异常
   */
  async refund(
    outTradeNo: string,
    refundAmount: number,
    refundReason: string,
  ): Promise<{ success: boolean; refundNo?: string; message?: string }> {
    const appId = await this.getConfig('alipay_app_id');
    const privateKey = await this.getConfig('alipay_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !privateKey) {
      this.logger.error('[Alipay] 支付宝配置缺失，无法退款');
      throw new BadRequestException('支付宝配置不完整，请联系管理员');
    }

    // 安全修复：使用更长的随机后缀防止碰撞
    const refundNo = `RFD${Date.now()}${CryptoUtil.randomString(8).toUpperCase()}`;

    const bizContent = {
      out_trade_no: outTradeNo,
      refund_amount: refundAmount.toFixed(2),
      refund_reason: refundReason,
      out_request_no: refundNo,
    };

    const params: Record<string, string> = {
      app_id: appId,
      method: 'alipay.trade.refund',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params, privateKey);

    try {
      const response = await fetch(this.gateway, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: this.buildQueryString(params),
      });

      const result = await response.json();
      this.logger.log(`[Alipay] 退款响应: ${JSON.stringify(result.alipay_trade_refund_response || result)}`);

      if (result.alipay_trade_refund_response?.code === '10000') {
        return { success: true, refundNo };
      }

      return {
        success: false,
        message: result.alipay_trade_refund_response?.msg || result.alipay_trade_refund_response?.sub_msg || '退款失败',
      };
    } catch (error) {
      this.logger.error('[Alipay] 退款失败:', error);
      return {
        success: false,
        message: error.message || '退款失败',
      };
    }
  }

  /**
   * RSA签名
   * 使用RSA2(SHA256)签名
   */
  private sign(params: Record<string, string>, privateKey: string): string {
    // 移除sign字段
    const { sign: _, ...data } = params;

    // 排序并构建待签名字符串
    const signData = Object.keys(data)
      .filter((key) => data[key] !== '' && data[key] !== undefined)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    // 使用私钥签名
    const formattedKey = this.formatPrivateKey(privateKey);

    try {
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signData);
      return signer.sign(formattedKey, 'base64');
    } catch (error: any) {
      // 如果 PKCS#8 格式失败，尝试 PKCS#1 格式
      this.logger.warn('[Alipay] PKCS#8 格式签名失败，尝试 PKCS#1 格式');
      const cleanKey = privateKey.replaceAll(/\s+/g, '');
      if (!cleanKey.startsWith('-----BEGIN')) {
        const formattedKeyPKCS1 = `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey}\n-----END RSA PRIVATE KEY-----`;
        try {
          const signer = crypto.createSign('RSA-SHA256');
          signer.update(signData);
          return signer.sign(formattedKeyPKCS1, 'base64');
        } catch (e: any) {
          this.logger.error('[Alipay] PKCS#1 格式签名也失败:', e.message);
          throw new BadRequestException('支付宝私钥格式错误，请检查配置');
        }
      }
      this.logger.error('[Alipay] 签名失败:', error.message);
      throw new BadRequestException('支付宝签名失败，请检查私钥配置');
    }
  }

  /**
   * 格式化私钥
   * 支持多种格式的私钥输入
   * 兼容 OpenSSL 3.x (使用 PKCS#8 格式)
   */
  private formatPrivateKey(key: string): string {
    // 移除所有空白字符
    const cleanKey = key.replaceAll(/\s+/g, '');

    // 如果已经是 PEM 格式，直接返回
    if (cleanKey.startsWith('-----BEGIN')) {
      return key;
    }

    // 格式化为标准的PEM格式（每行64字符）
    // 使用 PKCS#8 格式（兼容 OpenSSL 3.x）
    const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;

    // 尝试两种格式：PKCS#8 和 PKCS#1
    // 先尝试 PKCS#8 格式（推荐，兼容 OpenSSL 3.x）
    return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  /**
   * 格式化公钥
   * 支持多种格式的公钥输入
   */
  private formatPublicKey(key: string): string {
    // 移除所有空白字符
    const cleanKey = key.replaceAll(/\s+/g, '');

    if (cleanKey.startsWith('-----BEGIN')) {
      return key;
    }

    // 格式化为标准的PEM格式（每行64字符）
    const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;
    return `-----BEGIN PUBLIC KEY-----\n${formattedKey}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 构建查询字符串（URL编码）
   */
  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  /**
   * 格式化时间（支付宝时间格式：yyyy-MM-dd HH:mm:ss）
   */
  private formatTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
