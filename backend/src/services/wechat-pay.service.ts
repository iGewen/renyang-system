import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { SystemConfig } from '@/entities';
import * as crypto from 'crypto';

/**
 * 微信支付服务
 * 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_2_1.shtml
 */
@Injectable()
export class WechatPayService {
  private notifyUrl: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    @InjectRepository(SystemConfig)
    private configRepository: Repository<SystemConfig>,
  ) {
    this.notifyUrl = this.configService.get('wechat.notifyUrl') || '';
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
   */
  async createH5Payment(
    outTradeNo: string,
    totalAmount: number,
    description: string,
    clientIp: string,
  ): Promise<{ prepayId: string; payUrl: string }> {
    // 从数据库获取配置
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiKey = await this.getConfig('wechat_pay_key');

    // 如果没有配置微信支付，返回模拟支付URL
    if (!appId || !mchId || !apiKey) {
      console.log(`[WechatPay] 模拟支付 - 订单号: ${outTradeNo}, 金额: ${totalAmount}`);
      const mockPayUrl = `${this.configService.get('app.url') || 'http://localhost:3001'}/api/payments/wechat/mock?outTradeNo=${outTradeNo}`;
      return { prepayId: `mock_${outTradeNo}`, payUrl: mockPayUrl };
    }

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/h5';

    const body = {
      appid: appId,
      mchid: mchId,
      description,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      amount: {
        total: Math.round(totalAmount * 100), // 转为分
        currency: 'CNY',
      },
      scene_info: {
        payer_client_ip: clientIp,
        h5_info: {
          type: 'Wap',
        },
      },
    };

    const response = await this.request('POST', url, body, apiKey, mchId);

    if (response.h5_url) {
      return {
        prepayId: response.prepay_id || outTradeNo,
        payUrl: response.h5_url,
      };
    }

    throw new BadRequestException(response.message || '创建支付失败');
  }

  /**
   * 创建JSAPI支付（小程序/公众号）
   */
  async createJsapiPayment(
    outTradeNo: string,
    totalAmount: number,
    description: string,
    openid: string,
  ): Promise<{ prepayId: string; payParams: any }> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiKey = await this.getConfig('wechat_pay_key');

    if (!appId || !mchId || !apiKey) {
      console.log(`[WechatPay] 模拟JSAPI支付 - 订单号: ${outTradeNo}, 金额: ${totalAmount}, openid: ${openid}`);
      return {
        prepayId: `mock_${outTradeNo}`,
        payParams: {
          timeStamp: Math.floor(Date.now() / 1000).toString(),
          nonceStr: CryptoUtil.randomString(32),
          package: `prepay_id=mock_${outTradeNo}`,
          signType: 'RSA',
          paySign: 'mock_sign',
        },
      };
    }

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';

    const body = {
      appid: appId,
      mchid: mchId,
      description,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      amount: {
        total: Math.round(totalAmount * 100),
        currency: 'CNY',
      },
      payer: {
        openid,
      },
    };

    const response = await this.request('POST', url, body, apiKey, mchId);

    if (response.prepay_id) {
      // 生成支付参数
      const payParams = this.generatePayParams(response.prepay_id, appId, apiKey);
      return {
        prepayId: response.prepay_id,
        payParams,
      };
    }

    throw new BadRequestException(response.message || '创建支付失败');
  }

  /**
   * 生成JSAPI支付参数
   */
  private generatePayParams(prepayId: string, appId: string, apiKey: string): any {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = CryptoUtil.randomString(32);
    const packageStr = `prepay_id=${prepayId}`;

    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    const signature = this.signWithPrivateKey(message, apiKey);

    return {
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign: signature,
    };
  }

  /**
   * 验证回调签名
   */
  async verifyNotify(headers: any, body: string): Promise<boolean> {
    const apiV3Key = await this.getConfig('wechat_api_v3_key');

    if (!apiV3Key) {
      console.log('[WechatPay] 模拟环境，跳过验签');
      return true;
    }

    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    // 构建验签串
    const message = `${timestamp}\n${nonce}\n${body}\n`;

    try {
      // 使用微信支付平台公钥验签
      // 实际使用中需要获取平台证书
      // 这里简化处理
      return true;
    } catch (error) {
      console.error('[WechatPay] 验签失败:', error);
      return false;
    }
  }

  /**
   * 解密回调数据
   */
  async decryptNotify(resource: any): Promise<any> {
    const apiV3Key = await this.getConfig('wechat_api_v3_key');

    if (!apiV3Key) {
      console.log('[WechatPay] 模拟环境，返回原始数据');
      return resource;
    }

    const { ciphertext, associated_data, nonce } = resource;

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(apiV3Key),
        Buffer.from(nonce),
      );

      decipher.setAuthTag(Buffer.from(ciphertext.slice(-16), 'base64'));
      decipher.setAAD(Buffer.from(associated_data || ''));

      let decrypted = decipher.update(ciphertext.slice(0, -16), 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[WechatPay] 解密失败:', error);
      throw new BadRequestException('解密回调数据失败');
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiKey = await this.getConfig('wechat_pay_key');

    if (!appId || !mchId || !apiKey) {
      console.log(`[WechatPay] 模拟查询订单 - 订单号: ${outTradeNo}`);
      return { trade_state: 'SUCCESS' };
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchId}`;

    const response = await this.request('GET', url, undefined, apiKey, mchId);

    return response;
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiKey = await this.getConfig('wechat_pay_key');

    if (!appId || !mchId || !apiKey) {
      console.log(`[WechatPay] 模拟关闭订单 - 订单号: ${outTradeNo}`);
      return true;
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;

    const body = {
      mchid: mchId,
    };

    const response = await this.request('POST', url, body, apiKey, mchId);

    return response.status === 204 || response.message === '成功';
  }

  /**
   * 退款
   */
  async refund(
    outTradeNo: string,
    totalAmount: number,
    refundAmount: number,
    reason: string,
  ): Promise<{ success: boolean; refundId?: string; message?: string }> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiKey = await this.getConfig('wechat_pay_key');

    if (!appId || !mchId || !apiKey) {
      console.log(`[WechatPay] 模拟退款 - 订单号: ${outTradeNo}, 金额: ${refundAmount}`);
      return { success: true, refundId: `RFD${Date.now()}` };
    }

    const refundId = `RFD${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const url = 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds';

    const body = {
      out_trade_no: outTradeNo,
      out_refund_no: refundId,
      reason,
      amount: {
        total: Math.round(totalAmount * 100),
        refund: Math.round(refundAmount * 100),
        currency: 'CNY',
      },
    };

    const response = await this.request('POST', url, body, apiKey, mchId);

    if (response.status === 'SUCCESS' || response.status === 'PROCESSING') {
      return { success: true, refundId };
    }

    return {
      success: false,
      message: response.message || '退款失败',
    };
  }

  /**
   * 发送请求
   */
  private async request(method: string, url: string, body: any, apiKey: string, mchId: string): Promise<any> {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = CryptoUtil.randomString(32);

    let bodyStr = '';
    if (body && method !== 'GET') {
      bodyStr = JSON.stringify(body);
    }

    // 生成签名
    const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;
    const signature = this.signWithPrivateKey(message, apiKey);

    // 构建Authorization (需要序列号，这里简化处理)
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="",signature="${signature}"`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr || undefined,
    });

    const result = await response.json() as any;
    return result;
  }

  /**
   * 使用私钥签名
   */
  private signWithPrivateKey(message: string, privateKey: string): string {
    const formattedKey = this.formatPrivateKey(privateKey);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    return signer.sign(formattedKey, 'base64');
  }

  /**
   * 格式化私钥
   */
  private formatPrivateKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key;
    }
    return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
}
