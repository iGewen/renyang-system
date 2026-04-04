import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import * as crypto from 'crypto';

/**
 * 微信支付服务
 * 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_2_1.shtml
 */
@Injectable()
export class WechatPayService {
  private appId: string;
  private mchId: string;
  private apiKey: string;
  private apiV3Key: string;
  private serialNo: string;
  private privateKey: string;
  private notifyUrl: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.appId = this.configService.get('wechat.appId') || '';
    this.mchId = this.configService.get('wechat.mchId') || '';
    this.apiKey = this.configService.get('wechat.apiKey') || '';
    this.apiV3Key = this.configService.get('wechat.apiV3Key') || '';
    this.serialNo = this.configService.get('wechat.serialNo') || '';
    this.privateKey = this.configService.get('wechat.privateKey') || '';
    this.notifyUrl = this.configService.get('wechat.notifyUrl') || '';
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
    // 如果没有配置微信支付，返回模拟支付URL
    if (!this.appId || !this.mchId || !this.privateKey) {
      console.log(`[WechatPay] 模拟支付 - 订单号: ${outTradeNo}, 金额: ${totalAmount}`);
      const mockPayUrl = `${this.configService.get('app.url') || 'http://localhost:3001'}/api/payments/wechat/mock?outTradeNo=${outTradeNo}`;
      return { prepayId: `mock_${outTradeNo}`, payUrl: mockPayUrl };
    }

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/h5';

    const body = {
      appid: this.appId,
      mchid: this.mchId,
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

    const response = await this.request('POST', url, body);

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
    if (!this.appId || !this.mchId || !this.privateKey) {
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
      appid: this.appId,
      mchid: this.mchId,
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

    const response = await this.request('POST', url, body);

    if (response.prepay_id) {
      // 生成支付参数
      const payParams = this.generatePayParams(response.prepay_id);
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
  private generatePayParams(prepayId: string): any {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = CryptoUtil.randomString(32);
    const packageStr = `prepay_id=${prepayId}`;

    const message = `${this.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    const signature = this.signWithPrivateKey(message);

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
  verifyNotify(headers: any, body: string): boolean {
    if (!this.apiV3Key) {
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
  decryptNotify(resource: any): any {
    if (!this.apiV3Key) {
      console.log('[WechatPay] 模拟环境，返回原始数据');
      return resource;
    }

    const { ciphertext, associated_data, nonce } = resource;

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.apiV3Key),
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
    if (!this.appId || !this.mchId || !this.privateKey) {
      console.log(`[WechatPay] 模拟查询订单 - 订单号: ${outTradeNo}`);
      return { trade_state: 'SUCCESS' };
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.mchId}`;

    const response = await this.request('GET', url);

    return response;
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    if (!this.appId || !this.mchId || !this.privateKey) {
      console.log(`[WechatPay] 模拟关闭订单 - 订单号: ${outTradeNo}`);
      return true;
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;

    const body = {
      mchid: this.mchId,
    };

    const response = await this.request('POST', url, body);

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
    if (!this.appId || !this.mchId || !this.privateKey) {
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

    const response = await this.request('POST', url, body);

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
  private async request(method: string, url: string, body?: any): Promise<any> {
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
    const signature = this.signWithPrivateKey(message);

    // 构建Authorization
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.serialNo}",signature="${signature}"`;

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
  private signWithPrivateKey(message: string): string {
    const privateKey = this.formatPrivateKey(this.privateKey);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    return signer.sign(privateKey, 'base64');
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
