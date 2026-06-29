import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@/common/utils/redis.service';
import { SystemConfig } from '@/entities';
import { IdUtil } from '@/common/utils/id.util';
import Pay from 'wechatpay-node-v3';
import * as crypto from 'crypto';
import { Certificate } from '@fidm/x509';

/**
 * 微信支付服务 (使用官方SDK wechatpay-node-v3)
 *
 * 重构收益：
 * - 代码量从 805 行减少到 ~180 行
 * - 签名、验签、证书管理由SDK自动处理
 * - 无需手动拼接签名串和AES解密
 */
@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private readonly notifyUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
  ) {
    this.notifyUrl = this.configService.get('wechat.notifyUrl') || '';
  }

  /**
   * 从数据库获取配置（带缓存）
   */
  private async getConfig(key: string): Promise<string> {
    const cacheKey = `system:config:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const config = await this.configRepository.findOne({ where: { configKey: key } });
    const value = config?.configValue || '';
    await this.redisService.set(cacheKey, value, 300);
    return value;
  }

  /**
   * 初始化支付实例
   */
  private async initPayment(): Promise<Pay> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');
    const publicKey = await this.getConfig('wechat_public_key');

    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      throw new BadRequestException('微信支付未配置，请在后台配置微信支付参数');
    }

    // 如果没有配置微信平台公钥，使用空 Buffer（SDK 会自动下载）
    const publicKeyBuffer = publicKey ? Buffer.from(publicKey) : Buffer.from('');

    return new Pay({
      appid: appId,
      mchid: mchId,
      serial_no: serialNo,
      privateKey: Buffer.from(privateKey),
      publicKey: publicKeyBuffer,
      key: apiV3Key,
    });
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
    const payment = await this.initPayment();
    const notifyUrl = await this.getConfig('wechat_notify_url') || this.notifyUrl;

    try {
      const result = await payment.transactions_h5({
        out_trade_no: outTradeNo,
        amount: {
          total: Math.round(totalAmount * 100),
          currency: 'CNY',
        },
        description,
        scene_info: {
          payer_client_ip: clientIp,
          h5_info: {
            type: 'Wap',
            app_name: '云端牧场智慧平台',
          },
        },
        notify_url: notifyUrl,
      });

      if (result.status === 200 && result.data?.h5_url) {
        return {
          prepayId: result.data.prepay_id || outTradeNo,
          payUrl: result.data.h5_url,
        };
      }

      throw new BadRequestException(result.error?.message || '创建支付失败');
    } catch (error: any) {
      this.logger.error('[WechatPay] 创建H5支付失败:', error);
      throw new BadRequestException(error.message || '创建支付失败');
    }
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
    const payment = await this.initPayment();
    const appId = await this.getConfig('wechat_app_id');
    const notifyUrl = await this.getConfig('wechat_notify_url') || this.notifyUrl;

    try {
      const result = await payment.transactions_jsapi({
        out_trade_no: outTradeNo,
        amount: {
          total: Math.round(totalAmount * 100),
          currency: 'CNY',
        },
        description,
        payer: { openid },
        notify_url: notifyUrl,
      });

      if (result.status === 200) {
        // SDK 可能返回 prepay_id 在 data.prepay_id 或 data.package 字段中
        let prepayId = result.data?.prepay_id;
        if (!prepayId && result.data?.package) {
          const match = String(result.data.package).match(/prepay_id=(.+)/);
          if (match) prepayId = match[1];
        }
        if (prepayId) {
          // 生成前端支付参数
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const nonceStr = Math.random().toString(36).substring(2, 18);
          const packageStr = `prepay_id=${prepayId}`;
          const paySign = payment.sha256WithRsa(
            `${appId}\n${timestamp}\n${nonceStr}\n${packageStr}\n`
          );

          return {
            prepayId,
            payParams: {
              appId,
              timeStamp: timestamp,
              nonceStr,
              package: packageStr,
              signType: 'RSA',
              paySign,
            },
          };
        }
      }

      this.logger.error(`[WechatPay] JSAPI支付失败: status=${result.status}, error=${JSON.stringify(result.error)}, data=${JSON.stringify(result.data)}`);
      throw new BadRequestException(result.error?.message || '创建支付失败');
    } catch (error: any) {
      this.logger.error('[WechatPay] 创建JSAPI支付失败:', error);
      throw new BadRequestException(error.message || '创建支付失败');
    }
  }

  /**
   * 验证回调签名
   */
  async verifyNotify(headers: any, body: string): Promise<boolean> {
    const serial = headers['wechatpay-serial'];
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    try {
      // 1) 优先使用 SDK verifySign（走 Pay.certificates 内存缓存）
      const payment = await this.initPayment();
      const apiV3Key = await this.getConfig('wechat_api_v3_key');

      const result = await payment.verifySign({
        timestamp,
        nonce,
        body: bodyStr,
        serial,
        signature,
        apiSecret: apiV3Key,
      });

      return result;
    } catch (_err) {
      // 2) SDK 验签失败（平台证书未缓存），尝试从数据库加载公钥手动验签
      try {
        const publicKeyPem = await this.getConfig('wechat_public_key');
        if (!publicKeyPem) {
          this.logger.warn('[WechatPay] 验签失败且数据库无平台公钥，尝试主动拉取证书');
          await this.fetchAndSavePlatformCertificates();
          // 重试 SDK 验签（此时 Pay.certificates 已有缓存）
          const payment2 = await this.initPayment();
          const apiV3Key2 = await this.getConfig('wechat_api_v3_key');
          return await payment2.verifySign({
            timestamp, nonce, body: bodyStr, serial, signature, apiSecret: apiV3Key2,
          });
        }

        const data = `${timestamp}\n${nonce}\n${bodyStr}\n`;
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(data);
        return verify.verify(publicKeyPem, signature, 'base64');
      } catch (fallbackErr) {
        this.logger.error('[WechatPay] 手动验签也失败:', fallbackErr);
        return false;
      }
    }
  }

  /**
   * 解密回调数据
   */
  async decryptNotifyResource(resource: any): Promise<any> {
    try {
      const payment = await this.initPayment();
      const apiV3Key = await this.getConfig('wechat_api_v3_key');

      return payment.decipher_gcm(
        resource.ciphertext,
        resource.associated_data || '',
        resource.nonce,
        apiV3Key,
      );
    } catch (error) {
      this.logger.error('[WechatPay] 解密失败:', error);
      throw new BadRequestException('解密回调数据失败');
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    const payment = await this.initPayment();

    try {
      const result = await payment.query({
        out_trade_no: outTradeNo,
      });

      return result.data;
    } catch (error: any) {
      this.logger.error('[WechatPay] 查询订单失败:', error);
      throw new BadRequestException(error.message || '查询订单失败');
    }
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    const payment = await this.initPayment();

    try {
      const result = await payment.close(outTradeNo);
      return result.status === 200 || result.status === 204;
    } catch (error: any) {
      this.logger.error('[WechatPay] 关闭订单失败:', error);
      return false;
    }
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
    const payment = await this.initPayment();
    const notifyUrl = await this.getConfig('wechat_notify_url') || this.notifyUrl;

    try {
      const refundId = IdUtil.generateRefundNo();

      const result = await payment.refunds({
        out_trade_no: outTradeNo,
        out_refund_no: refundId,
        reason,
        amount: {
          total: Math.round(totalAmount * 100),
          refund: Math.round(refundAmount * 100),
          currency: 'CNY',
        },
        notify_url: notifyUrl,
      });

      const status = result.data?.status;
      if (status === 'SUCCESS' || status === 'PROCESSING') {
        return { success: true, refundId };
      }

      return {
        success: false,
        message: result.error?.message || '退款失败',
      };
    } catch (error: any) {
      this.logger.error('[WechatPay] 退款失败:', error);
      return {
        success: false,
        message: error.message || '退款失败',
      };
    }
  }

  /**
   * 查询退款
   */
  async queryRefund(outRefundNo: string): Promise<any> {
    const payment = await this.initPayment();

    try {
      const result = await payment.find_refunds(outRefundNo);
      return result.data;
    } catch (error: any) {
      this.logger.error('[WechatPay] 查询退款失败:', error);
      throw new BadRequestException(error.message || '查询退款失败');
    }
  }

  /**
   * 主动拉取并保存微信平台证书
   * 使用 Node.js crypto 手动构建 WeChat Pay API v3 认证请求
   */
  async fetchAndSavePlatformCertificates(): Promise<{ serialNo: string }> {
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKeyStr = await this.getConfig('wechat_private_key');

    if (!mchId || !apiV3Key || !serialNo || !privateKeyStr) {
      throw new BadRequestException('微信支付配置不完整');
    }

    const nonceStr = Math.random().toString(36).substring(2, 18);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const urlPath = '/v3/certificates';
    const signatureStr = `GET\n${urlPath}\n${timestamp}\n${nonceStr}\n\n`;

    const privateKey = crypto.createPrivateKey(privateKeyStr);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureStr);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;

    const response = await fetch('https://api.mch.weixin.qq.com/v3/certificates', {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'Accept-Language': 'zh-CN',
        'User-Agent': 'cloud-ranch-backend',
      },
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      this.logger.error(`[WechatPay] 拉取平台证书失败: status=${response.status}, body=${errBody}`);
      throw new BadRequestException(`拉取平台证书失败: ${response.status} ${errBody}`);
    }

    const result: any = await response.json();
    const data = result?.data || [];
    if (!data.length) {
      throw new BadRequestException('微信平台证书列表为空');
    }

    const cert = data[0];
    const decryptCert = this.decipherGcm(
      cert.encrypt_certificate.ciphertext,
      cert.encrypt_certificate.associated_data,
      cert.encrypt_certificate.nonce,
      apiV3Key,
    );

    // 从 PEM 提取公钥
    const pemCert = Certificate.fromPEM(Buffer.from(decryptCert));
    const publicKeyPem = pemCert.publicKey.toPEM();

    // 保存到数据库
    const existing = await this.configRepository.findOne({ where: { configKey: 'wechat_public_key' } });
    if (existing) {
      existing.configValue = publicKeyPem;
      await this.configRepository.save(existing);
    } else {
      await this.configRepository.insert({
        configKey: 'wechat_public_key',
        configValue: publicKeyPem,
        configType: 'payment',
        description: '微信平台公钥（自动同步）',
      });
    }

    // 清除 Redis 缓存，下次 initPayment 会读取新值
    await this.redisService.del('system:config:wechat_public_key');

    this.logger.log(`[WechatPay] 平台证书同步成功: serial_no=${cert.serial_no}`);
    return { serialNo: cert.serial_no };
  }

  /**
   * AES-256-GCM 解密
   */
  private decipherGcm(ciphertext: string, associatedData: string, nonce: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'utf-8');
    const nonceBuffer = Buffer.from(nonce, 'utf-8');
    const cipherBuffer = Buffer.from(ciphertext, 'base64');
    const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
    const data = cipherBuffer.subarray(0, cipherBuffer.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, nonceBuffer);
    decipher.setAAD(Buffer.from(associatedData, 'utf-8'));
    decipher.setAuthTag(authTag);
    return decipher.update(data) + decipher.final('utf-8');
  }
}
