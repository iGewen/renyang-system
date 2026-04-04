import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import * as crypto from 'crypto';

/**
 * 支付宝支付服务
 * 文档：https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay
 */
@Injectable()
export class AlipayService {
  private appId: string;
  private privateKey: string;
  private alipayPublicKey: string;
  private notifyUrl: string;
  private returnUrl: string;
  private gateway: string = 'https://openapi.alipay.com/gateway.do';

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.appId = this.configService.get('alipay.appId') || '';
    this.privateKey = this.configService.get('alipay.privateKey') || '';
    this.alipayPublicKey = this.configService.get('alipay.alipayPublicKey') || '';
    this.notifyUrl = this.configService.get('alipay.notifyUrl') || '';
    this.returnUrl = this.configService.get('alipay.returnUrl') || '';
  }

  /**
   * 创建H5支付
   */
  async createH5Payment(
    outTradeNo: string,
    totalAmount: number,
    subject: string,
    body?: string,
  ): Promise<{ payUrl: string }> {
    // 如果没有配置支付宝，返回模拟支付URL
    if (!this.appId || !this.privateKey) {
      console.log(`[Alipay] 模拟支付 - 订单号: ${outTradeNo}, 金额: ${totalAmount}`);
      const mockPayUrl = `${this.configService.get('app.url') || 'http://localhost:3001'}/api/payments/alipay/mock?outTradeNo=${outTradeNo}`;
      return { payUrl: mockPayUrl };
    }

    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: totalAmount.toFixed(2),
      subject,
      body: body || subject,
      product_code: 'QUICK_WAP_WAY',
    };

    const params: Record<string, string> = {
      app_id: this.appId,
      method: 'alipay.trade.wap.pay',
      format: 'JSON',
      return_url: this.returnUrl,
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      notify_url: this.notifyUrl,
      biz_content: JSON.stringify(bizContent),
    };

    // 签名
    params.sign = this.sign(params);

    // 构建支付URL
    const payUrl = `${this.gateway}?${this.buildQueryString(params)}`;

    return { payUrl };
  }

  /**
   * 验证回调签名
   */
  verifyNotify(params: Record<string, string>): boolean {
    if (!this.alipayPublicKey) {
      console.log('[Alipay] 模拟环境，跳过验签');
      return true;
    }

    const sign = params.sign;
    const signType = params.sign_type;

    // 移除sign和sign_type
    const { sign: _, sign_type: __, ...data } = params;

    // 排序并构建待签名字符串
    const signData = Object.keys(data)
      .filter((key) => data[key] !== '')
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signData);

      // 格式化公钥
      const publicKey = this.formatPublicKey(this.alipayPublicKey);

      return verify.verify(publicKey, sign, 'base64');
    } catch (error) {
      console.error('[Alipay] 验签失败:', error);
      return false;
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    if (!this.appId || !this.privateKey) {
      console.log(`[Alipay] 模拟查询订单 - 订单号: ${outTradeNo}`);
      return { trade_status: 'TRADE_SUCCESS' };
    }

    const bizContent = {
      out_trade_no: outTradeNo,
    };

    const params: Record<string, string> = {
      app_id: this.appId,
      method: 'alipay.trade.query',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params);

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildQueryString(params),
    });

    const result = await response.json() as any;
    return result.alipay_trade_query_response;
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    if (!this.appId || !this.privateKey) {
      console.log(`[Alipay] 模拟关闭订单 - 订单号: ${outTradeNo}`);
      return true;
    }

    const bizContent = {
      out_trade_no: outTradeNo,
    };

    const params: Record<string, string> = {
      app_id: this.appId,
      method: 'alipay.trade.close',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params);

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildQueryString(params),
    });

    const result = await response.json() as any;
    return result.alipay_trade_close_response?.code === '10000';
  }

  /**
   * 退款
   */
  async refund(
    outTradeNo: string,
    refundAmount: number,
    refundReason: string,
  ): Promise<{ success: boolean; refundNo?: string; message?: string }> {
    if (!this.appId || !this.privateKey) {
      console.log(`[Alipay] 模拟退款 - 订单号: ${outTradeNo}, 金额: ${refundAmount}`);
      return { success: true, refundNo: `RFD${Date.now()}` };
    }

    const refundNo = `RFD${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const bizContent = {
      out_trade_no: outTradeNo,
      refund_amount: refundAmount.toFixed(2),
      refund_reason: refundReason,
      out_request_no: refundNo,
    };

    const params: Record<string, string> = {
      app_id: this.appId,
      method: 'alipay.trade.refund',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatTime(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };

    params.sign = this.sign(params);

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.buildQueryString(params),
    });

    const result = await response.json() as any;

    if (result.alipay_trade_refund_response?.code === '10000') {
      return { success: true, refundNo };
    }

    return {
      success: false,
      message: result.alipay_trade_refund_response?.msg || '退款失败',
    };
  }

  /**
   * RSA签名
   */
  private sign(params: Record<string, string>): string {
    // 移除sign字段
    const { sign: _, ...data } = params;

    // 排序并构建待签名字符串
    const signData = Object.keys(data)
      .filter((key) => data[key] !== '')
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    // 使用私钥签名
    const privateKey = this.formatPrivateKey(this.privateKey);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signData);

    return signer.sign(privateKey, 'base64');
  }

  /**
   * 格式化私钥
   */
  private formatPrivateKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key;
    }
    return `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
  }

  /**
   * 格式化公钥
   */
  private formatPublicKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key;
    }
    return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
  }

  /**
   * 构建查询字符串
   */
  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  /**
   * 格式化时间
   */
  private formatTime(date: Date): string {
    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  }
}
