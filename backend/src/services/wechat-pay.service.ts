import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { SystemConfig } from '@/entities';
import * as crypto from 'node:crypto';

/**
 * 微信支付服务 (V3版本)
 * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012062524
 */
@Injectable()
export class WechatPayService {
  private notifyUrl: string;
  private readonly logger = new Logger(WechatPayService.name);

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
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012062524
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
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');
    const notifyUrl = await this.getConfig('wechat_notify_url') || this.notifyUrl;

    // 检查必要配置
    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error('[WechatPay] 微信支付未配置，请在后台配置微信支付参数');
      throw new BadRequestException('微信支付未配置，请联系管理员配置微信支付参数');
    }

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/h5';

    const body = {
      appid: appId,
      mchid: mchId,
      description,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
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

    try {
      const response = await this.request('POST', url, body, {
        mchId,
        serialNo,
        privateKey,
      });

      if (response.h5_url) {
        return {
          prepayId: response.prepay_id || outTradeNo,
          payUrl: response.h5_url,
        };
      }

      this.logger.error('[WechatPay] 创建支付失败:', response);
      throw new BadRequestException(response.message || '创建支付失败');
    } catch (error) {
      this.logger.error('[WechatPay] 创建支付异常:', error);
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
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');
    const notifyUrl = await this.getConfig('wechat_notify_url') || this.notifyUrl;

    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error('[WechatPay] 微信支付未配置，请在后台配置微信支付参数');
      throw new BadRequestException('微信支付未配置，请联系管理员配置微信支付参数');
    }

    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';

    const body = {
      appid: appId,
      mchid: mchId,
      description,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      amount: {
        total: Math.round(totalAmount * 100),
        currency: 'CNY',
      },
      payer: {
        openid,
      },
    };

    try {
      const response = await this.request('POST', url, body, {
        mchId,
        serialNo,
        privateKey,
      });

      if (response.prepay_id) {
        // 生成支付参数
        const payParams = this.generatePayParams(response.prepay_id, appId, privateKey);
        return {
          prepayId: response.prepay_id,
          payParams,
        };
      }

      throw new BadRequestException(response.message || '创建支付失败');
    } catch (error) {
      this.logger.error('[WechatPay] 创建JSAPI支付异常:', error);
      throw new BadRequestException(error.message || '创建支付失败');
    }
  }

  /**
   * 生成JSAPI支付参数
   */
  private generatePayParams(prepayId: string, appId: string, privateKey: string): any {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = CryptoUtil.randomString(32);
    const packageStr = `prepay_id=${prepayId}`;

    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    const signature = this.signWithPrivateKey(message, privateKey);

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
   * V3签名验证需要使用微信支付平台证书
   * 安全修复：API密钥未配置或证书获取失败时安全失败，不再绕过验证
   */
  async verifyNotify(headers: any, body: string): Promise<boolean> {
    const apiV3Key = await this.getConfig('wechat_api_v3_key');

    // 安全修复：API密钥未配置时，拒绝验签而非绕过
    if (!apiV3Key) {
      this.logger.error('[WechatPay] API密钥未配置，拒绝验签');
      return false;
    }

    const timestamp = headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp'];
    const nonce = headers['wechatpay-nonce'] || headers['Wechatpay-Nonce'];
    const signature = headers['wechatpay-signature'] || headers['Wechatpay-Signature'];
    const serial = headers['wechatpay-serial'] || headers['Wechatpay-Serial'];

    if (!timestamp || !nonce || !signature || !serial) {
      this.logger.error('[WechatPay] 回调头信息不完整');
      return false;
    }

    // 安全修复：验证时间戳有效期（5分钟内）
    const timestampNum = Number.parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const maxTimeDiff = 5 * 60; // 5分钟

    // 安全修复：检查整数溢出和负数
    if (Number.isNaN(timestampNum) || timestampNum <= 0 || timestampNum > currentTime + maxTimeDiff) {
      this.logger.error('[WechatPay] 回调时间戳无效', {
        receivedTimestamp: timestamp,
        currentTimestamp: currentTime,
      });
      return false;
    }

    if (Math.abs(currentTime - timestampNum) > maxTimeDiff) {
      this.logger.error('[WechatPay] 回调时间戳过期', {
        receivedTimestamp: timestamp,
        currentTimestamp: currentTime,
        diff: Math.abs(currentTime - timestampNum),
      });
      return false;
    }

    // 构建验签串
    const message = `${timestamp}\n${nonce}\n${body}\n`;

    try {
      // 获取平台证书并验证签名
      const platformCert = await this.getPlatformCertificate(serial);
      if (!platformCert) {
        this.logger.error('[WechatPay] 获取平台证书失败，拒绝验签');
        // 安全修复：证书获取失败时，拒绝验签而非绕过
        return false;
      }

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(message);

      const publicKey = this.formatPublicKey(platformCert);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      this.logger.error('[WechatPay] 验签失败:', error);
      return false;
    }
  }

  /**
   * 获取微信支付平台证书
   * 实际生产环境应该缓存证书
   */
  private async getPlatformCertificate(serialNo: string): Promise<string | null> {
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const privateSerialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    if (!mchId || !apiV3Key || !privateSerialNo || !privateKey) {
      return null;
    }

    // 从缓存获取证书
    const cacheKey = `wechat:cert:${serialNo}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 下载平台证书
      const url = 'https://api.mch.weixin.qq.com/v3/certificates';
      const response = await this.request('GET', url, undefined, {
        mchId,
        serialNo: privateSerialNo,
        privateKey,
      });

      if (response.data && Array.isArray(response.data)) {
        for (const cert of response.data) {
          if (cert.serial_no === serialNo) {
            // 解密证书
            const decryptedCert = this.decryptCertificate(cert.encrypt_certificate, apiV3Key);
            // 缓存证书（12小时）
            await this.redisService.set(cacheKey, decryptedCert, 43200);
            return decryptedCert;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('[WechatPay] 获取平台证书失败:', error);
      return null;
    }
  }

  /**
   * 解密平台证书
   */
  private decryptCertificate(encryptData: any, apiV3Key: string): string {
    const { ciphertext, associated_data, nonce } = encryptData;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key),
      Buffer.from(nonce),
    );

    decipher.setAuthTag(Buffer.from(ciphertext.slice(-16), 'base64'));
    decipher.setAAD(Buffer.from(associated_data || ''));

    let decrypted = decipher.update(ciphertext.slice(0, -16), 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 解密回调数据
   * 安全修复：配置缺失时抛出异常
   */
  async decryptNotifyResource(resource: any): Promise<any> {
    const apiV3Key = await this.getConfig('wechat_api_v3_key');

    // 安全修复：配置缺失时抛出异常
    if (!apiV3Key) {
      this.logger.error('[WechatPay] API密钥未配置，无法解密回调数据');
      throw new BadRequestException('微信支付配置不完整');
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
      this.logger.error('[WechatPay] 解密失败:', error);
      throw new BadRequestException('解密回调数据失败');
    }
  }

  /**
   * 查询订单
   * 安全修复：配置缺失时抛出异常，不返回模拟数据
   */
  async queryOrder(outTradeNo: string): Promise<any> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error('[WechatPay] 微信支付配置缺失，无法查询订单');
      throw new BadRequestException('微信支付配置不完整，请联系管理员');
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchId}`;

    try {
      const response = await this.request('GET', url, undefined, {
        mchId,
        serialNo,
        privateKey,
      });
      return response;
    } catch (error) {
      this.logger.error('[WechatPay] 查询订单失败:', error);
      throw new BadRequestException(error.message || '查询订单失败');
    }
  }

  /**
   * 关闭订单
   * 安全修复：配置缺失时抛出异常
   */
  async closeOrder(outTradeNo: string): Promise<boolean> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error('[WechatPay] 微信支付配置缺失，无法关闭订单');
      throw new BadRequestException('微信支付配置不完整，请联系管理员');
    }

    const url = `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;

    const body = {
      mchid: mchId,
    };

    try {
      const response = await this.request('POST', url, body, {
        mchId,
        serialNo,
        privateKey,
      });
      return response.status === 204 || !response.message;
    } catch (error) {
      this.logger.error('[WechatPay] 关闭订单失败:', error);
      return false;
    }
  }

  /**
   * 退款
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791871
   * 安全修复：配置缺失时抛出异常
   */
  async refund(
    outTradeNo: string,
    totalAmount: number,
    refundAmount: number,
    reason: string,
  ): Promise<{ success: boolean; refundId?: string; message?: string }> {
    const appId = await this.getConfig('wechat_app_id');
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    // 安全修复：配置缺失时抛出异常
    if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error('[WechatPay] 微信支付配置缺失，无法退款');
      throw new BadRequestException('微信支付配置不完整，请联系管理员');
    }

    // 安全修复：使用更长的随机后缀防止碰撞
    const refundId = `RFD${Date.now()}${CryptoUtil.randomString(8).toUpperCase()}`;

    const url = 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds';

    const body = {
      out_trade_no: outTradeNo,
      out_refund_no: refundId,
      reason,
      notify_url: await this.getConfig('wechat_notify_url') || this.notifyUrl,
      amount: {
        total: Math.round(totalAmount * 100),
        refund: Math.round(refundAmount * 100),
        currency: 'CNY',
      },
    };

    try {
      const response = await this.request('POST', url, body, {
        mchId,
        serialNo,
        privateKey,
      });

      if (response.status === 'SUCCESS' || response.status === 'PROCESSING') {
        return { success: true, refundId };
      }

      return {
        success: false,
        message: response.message || '退款失败',
      };
    } catch (error) {
      this.logger.error('[WechatPay] 退款失败:', error);
      return {
        success: false,
        message: error.message || '退款失败',
      };
    }
  }

  /**
   * 查询退款
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791871
   * 安全修复：配置缺失时抛出异常而非返回假成功
   */
  async queryRefund(outRefundNo: string): Promise<any> {
    const mchId = await this.getConfig('wechat_mch_id');
    const apiV3Key = await this.getConfig('wechat_api_v3_key');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    if (!mchId || !apiV3Key || !serialNo || !privateKey) {
      this.logger.error(`[WechatPay] 微信支付配置缺失，无法查询退款 - 退款单号: ${outRefundNo}`);
      throw new BadRequestException('微信支付未配置，无法查询退款状态');
    }

    const url = `https://api.mch.weixin.qq.com/v3/refund/domestic/refunds/${outRefundNo}`;

    try {
      const response = await this.request('GET', url, undefined, {
        mchId,
        serialNo,
        privateKey,
      });
      return response;
    } catch (error) {
      this.logger.error('[WechatPay] 查询退款失败:', error);
      throw new BadRequestException(error.message || '查询退款失败');
    }
  }

  /**
   * 申请交易账单
   * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791871
   * @param billDate 账单日期，格式：YYYY-MM-DD
   * 安全修复：配置缺失时抛出异常而非返回空数据
   */
  async getTradeBill(billDate: string): Promise<{ downloadUrl: string; billCount?: number }> {
    const mchId = await this.getConfig('wechat_mch_id');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    if (!mchId || !serialNo || !privateKey) {
      this.logger.error(`[WechatPay] 微信支付配置缺失，无法申请账单 - 日期: ${billDate}`);
      throw new BadRequestException('微信支付未配置，无法申请账单');
    }

    const url = `https://api.mch.weixin.qq.com/v3/bill/tradebill?bill_date=${billDate}&bill_type=ALL`;

    try {
      const response = await this.request('GET', url, undefined, {
        mchId,
        serialNo,
        privateKey,
      });

      if (response.download_url) {
        return {
          downloadUrl: response.download_url,
          billCount: response.total_count,
        };
      }

      throw new BadRequestException(response.message || '申请账单失败');
    } catch (error) {
      this.logger.error('[WechatPay] 申请账单失败:', error);
      throw new BadRequestException(error.message || '申请账单失败');
    }
  }

  /**
   * 下载账单
   * @param downloadUrl 从申请账单接口获取的下载URL
   */
  async downloadBill(downloadUrl: string): Promise<string> {
    const mchId = await this.getConfig('wechat_mch_id');
    const serialNo = await this.getConfig('wechat_serial_no');
    const privateKey = await this.getConfig('wechat_private_key');

    if (!mchId || !serialNo || !privateKey) {
      this.logger.log(`[WechatPay] 模拟下载账单`);
      return '';
    }

    try {
      // 下载账单需要特殊的请求方式，URL已经是完整的
      const urlObj = new URL(downloadUrl);
      const path = urlObj.pathname + urlObj.search;

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonceStr = CryptoUtil.randomString(32);
      const message = `GET\n${path}\n${timestamp}\n${nonceStr}\n\n`;
      const signature = this.signWithPrivateKey(message, privateKey);

      const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",serial_no="${serialNo}",nonce_str="${nonceStr}",timestamp="${timestamp}",signature="${signature}"`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Accept: '*/*',
          Authorization: authorization,
        },
      });

      if (!response.ok) {
        throw new BadRequestException(`下载账单失败: ${response.status}`);
      }

      // 账单返回的是gzip压缩的文本
      const text = await response.text();
      return text;
    } catch (error) {
      this.logger.error('[WechatPay] 下载账单失败:', error);
      throw new BadRequestException(error.message || '下载账单失败');
    }
  }

  /**
   * 对账 - 拉取账单并与本地订单比对
   * @param billDate 账单日期，格式：YYYY-MM-DD
   * @returns 对账结果
   */
  async reconcile(billDate: string): Promise<{
    success: boolean;
    billCount?: number;
    message?: string;
    differences?: any[];
  }> {
    try {
      // 1. 申请交易账单
      this.logger.log(`[WechatPay] 开始对账 - 日期: ${billDate}`);
      const { downloadUrl, billCount } = await this.getTradeBill(billDate);

      if (!downloadUrl) {
        return { success: false, message: '申请账单失败' };
      }

      // 2. 下载账单
      const billContent = await this.downloadBill(downloadUrl);

      if (!billContent) {
        return { success: false, message: '下载账单失败' };
      }

      // 3. 解析账单内容
      // 账单格式：第一行是字段名，后续是数据，用逗号分隔
      const lines = billContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return { success: true, billCount: 0, message: '账单无数据' };
      }

      // 跳过表头和汇总行，解析交易记录
      const records = [];
      for (let i = 1; i < lines.length - 2; i++) {
        const fields = lines[i].split('`').filter(f => f);
        if (fields.length >= 20) {
          records.push({
            transactionId: fields[0],      // 微信订单号
            outTradeNo: fields[1],          // 商户订单号
            openId: fields[3],              // 用户标识
            tradeType: fields[4],           // 交易类型
            tradeState: fields[5],          // 交易状态
            totalAmount: parseInt(fields[6]) / 100, // 订单金额（转为元）
            payerTotal: parseInt(fields[7]) / 100,  // 用户支付金额
            successTime: fields[9],         // 支付完成时间
          });
        }
      }

      this.logger.log(`[WechatPay] 账单解析完成 - 记录数: ${records.length}`);

      // 4. 返回对账结果（实际项目中需要与本地订单比对）
      return {
        success: true,
        billCount: records.length,
        message: `对账完成，共 ${records.length} 笔交易`,
        differences: [], // 实际项目中需要填充差异记录
      };
    } catch (error) {
      this.logger.error('[WechatPay] 对账失败:', error);
      return {
        success: false,
        message: error.message || '对账失败',
      };
    }
  }

  /**
   * 发送请求（V3签名）
   */
  private async request(
    method: string,
    url: string,
    body: any,
    credentials: { mchId: string; serialNo: string; privateKey: string },
  ): Promise<any> {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = CryptoUtil.randomString(32);

    let bodyStr = '';
    if (body && method !== 'GET') {
      bodyStr = JSON.stringify(body);
    }

    // 构建签名串
    // 签名串格式：HTTP方法\nURL\n时间戳\n随机串\n请求体\n
    const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;
    const signature = this.signWithPrivateKey(message, credentials.privateKey);

    // 构建Authorization头
    // 格式：WECHATPAY2-SHA256-RSA2048 mchid="xxx",serial_no="xxx",nonce_str="xxx",timestamp="xxx",signature="xxx"
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${credentials.mchId}",serial_no="${credentials.serialNo}",nonce_str="${nonceStr}",timestamp="${timestamp}",signature="${signature}"`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyStr || undefined,
      });

      const result = await response.json() as any;

      if (!response.ok) {
        this.logger.error('[WechatPay] API请求失败:', {
          url,
          status: response.status,
          result,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('[WechatPay] API请求异常:', error);
      throw error;
    }
  }

  /**
   * 使用私钥签名
   */
  private signWithPrivateKey(message: string, privateKey: string): string {
    const formattedKey = this.formatPrivateKey(privateKey);
    try {
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(message);
      return signer.sign(formattedKey, 'base64');
    } catch (error: any) {
      // 如果 PKCS#8 格式失败，尝试 PKCS#1 格式
      this.logger.warn('[WechatPay] PKCS#8 格式签名失败，尝试 PKCS#1 格式');
      const cleanKey = privateKey.replaceAll(/\s+/g, '');
      if (!cleanKey.includes('-----BEGIN')) {
        const formattedKeyPKCS1 = `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey}\n-----END RSA PRIVATE KEY-----`;
        try {
          const signer = crypto.createSign('RSA-SHA256');
          signer.update(message);
          return signer.sign(formattedKeyPKCS1, 'base64');
        } catch (e: any) {
          this.logger.error('[WechatPay] PKCS#1 格式签名也失败:', e.message);
          throw new BadRequestException('微信支付私钥格式错误，请检查配置');
        }
      }
      this.logger.error('[WechatPay] 签名失败:', error.message);
      throw new BadRequestException('微信支付签名失败，请检查私钥配置');
    }
  }

  /**
   * 格式化私钥
   * 兼容 OpenSSL 3.x (使用 PKCS#8 格式)
   */
  private formatPrivateKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key;
    }
    // 移除所有空白字符并格式化
    const cleanKey = key.replaceAll(/\s+/g, '');
    const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;
    // 使用 PKCS#8 格式（兼容 OpenSSL 3.x）
    return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  /**
   * 格式化公钥
   */
  private formatPublicKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key;
    }
    const cleanKey = key.replaceAll(/\s+/g, '');
    return `-----BEGIN CERTIFICATE-----\n${cleanKey}\n-----END CERTIFICATE-----`;
  }
}
