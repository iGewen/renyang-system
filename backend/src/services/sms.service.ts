import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsCode, SystemConfig } from '@/entities';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { IdUtil } from '@/common/utils/id.util';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';

// 短信频率限制配置
const SMS_MAX_COUNT_PER_MINUTE = 5;
const SMS_BLACKLIST_DURATION = 600; // 10分钟
const SMS_IP_MAX_COUNT_PER_HOUR = 20; // 每小时每个IP最多20条

/**
 * 阿里云短信服务
 * 文档：https://help.aliyun.com/document_detail/101414.html
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectRepository(SmsCode)
    private readonly smsCodeRepository: Repository<SmsCode>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
  ) {}

  /**
   * 从数据库获取配置
   */
  private async getConfig(key: string): Promise<string> {
    const cacheKey = `system:config:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const config = await this.configRepository.findOne({
      where: { configKey: key },
    });

    const value = config?.configValue || '';
    await this.redisService.set(cacheKey, value, 300);
    return value;
  }

  /**
   * 获取短信配置
   */
  private async getSmsConfig() {
    const [accessKeyId, accessKeySecret, signName, templateLogin, templateRegister, templateResetPassword] = await Promise.all([
      this.getConfig('aliyun_access_key_id'),
      this.getConfig('aliyun_access_key_secret'),
      this.getConfig('aliyun_sign_name'),
      this.getConfig('sms_template_login'),
      this.getConfig('sms_template_register'),
      this.getConfig('sms_template_reset_password'),
    ]);

    return {
      accessKeyId,
      accessKeySecret,
      signName,
      templates: {
        login: templateLogin,
        register: templateRegister,
        reset_password: templateResetPassword,
      },
    };
  }

  /**
   * 发送验证码
   * 限制规则：
   * - 60秒内单个手机号最多发送5次
   * - 超过5次则拉黑10分钟
   * - 每小时单个IP最多发送20条
   */
  async sendVerificationCode(phone: string, type: string, clientIp?: string): Promise<{ success: boolean; code?: string }> {
    // 检查IP限制（防刷）
    if (clientIp) {
      const ipCountKey = `sms:ip:${clientIp}`;
      const ipCount = Number.parseInt(await this.redisService.get(ipCountKey) || '0', 10);
      if (ipCount >= SMS_IP_MAX_COUNT_PER_HOUR) {
        throw new BadRequestException('发送次数过多，请稍后再试');
      }
    }

    // 检查是否被拉黑（10分钟内发送超过5次）
    const blacklistKey = `sms:blacklist:${phone}`;
    const isBlacklisted = await this.redisService.exists(blacklistKey);
    if (isBlacklisted) {
      const ttl = await this.redisService.ttl(blacklistKey);
      const minutes = Math.ceil(ttl / 60);
      throw new BadRequestException(`验证码发送过于频繁，请在${minutes}分钟后重试`);
    }

    // 检查60秒内发送次数
    const countKey = `sms:count:${phone}`;
    const countStr = await this.redisService.get(countKey);
    const count = Number.parseInt(countStr || '0', 10);

    if (count >= SMS_MAX_COUNT_PER_MINUTE) {
      // 超过5次，拉黑10分钟
      await this.redisService.set(blacklistKey, '1', SMS_BLACKLIST_DURATION);
      throw new BadRequestException('验证码发送次数过多，请在10分钟后重试');
    }

    // 生成验证码
    const code = CryptoUtil.randomDigits(6);

    // 存储验证码到数据库
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    const smsCode = this.smsCodeRepository.create({
      id: IdUtil.generate('SMS'),
      phone,
      code,
      type,
      expireAt,
    });
    await this.smsCodeRepository.save(smsCode);

    // 存储验证码到Redis（用于快速验证）
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.set(codeKey, code, 300); // 5分钟

    // 增加发送次数（60秒窗口）
    if (count === 0) {
      await this.redisService.set(countKey, '1', 60);
    } else {
      await this.redisService.incr(countKey);
    }

    // 增加IP发送计数（1小时窗口）
    if (clientIp) {
      const ipCountKey = `sms:ip:${clientIp}`;
      const currentIpCount = await this.redisService.get(ipCountKey);
      if (currentIpCount) {
        await this.redisService.incr(ipCountKey);
      } else {
        await this.redisService.set(ipCountKey, '1', 3600);
      }
    }

    // 发送短信
    try {
      const config = await this.getSmsConfig();

      // 获取对应类型的模板
      const templateCode = config.templates[type as keyof typeof config.templates] || config.templates.login;

      await this.sendSms(phone, code, config, templateCode);
      return { success: true };
    } catch (error) {
      this.logger.error(`[SMS] 发送失败: ${error.message}`);
      // 开发环境返回验证码（安全修复：不在日志中打印完整验证码）
      if (this.configService.get('app.env') === 'development') {
        this.logger.log(`[SMS] 开发模式 - 验证码已发送至 ${phone.substring(0, 3)}****${phone.substring(7)}`);
        return { success: true, code };
      }
      throw new BadRequestException('短信发送失败，请稍后重试');
    }
  }

  /**
   * 验证验证码
   * 安全修复：验证成功后立即删除，防止重放攻击
   */
  async verifyCode(phone: string, code: string, type: string): Promise<boolean> {
    // 从Redis获取验证码
    const codeKey = `sms:code:${phone}:${type}`;
    const storedCode = await this.redisService.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('验证码已过期');
    }

    if (storedCode !== code) {
      throw new BadRequestException('验证码错误');
    }

    // 安全修复：验证成功后立即删除 Redis 中的验证码，防止重放攻击
    await this.redisService.del(codeKey);

    // 更新数据库中的验证码状态
    await this.smsCodeRepository.update(
      { phone, code, type, isUsed: 0 },
      { isUsed: 1 },
    );

    return true;
  }

  /**
   * 标记验证码已使用
   * @deprecated 已在 verifyCode 中自动处理
   */
  async markCodeUsed(phone: string, code: string, type: string): Promise<void> {
    // 兼容旧调用，实际已在 verifyCode 中处理
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.del(codeKey);

    await this.smsCodeRepository.update(
      { phone, code, type, isUsed: 0 },
      { isUsed: 1 },
    );
  }

  /**
   * 发送短信（调用阿里云API）
   */
  private async sendSms(phone: string, code: string, config: any, templateCode: string): Promise<void> {
    // 安全修复：日志中不打印验证码明文和完整手机号
    this.logger.log(`[SMS] 准备发送 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}`);
    this.logger.log(`[SMS] 配置检查 - accessKeyId: ${config.accessKeyId ? '已配置' : '未配置'}, accessKeySecret: ${config.accessKeySecret ? '已配置' : '未配置'}, signName: ${config.signName || '未配置'}, templateCode: ${templateCode || '未配置'}`);

    // 如果没有配置阿里云密钥，则跳过实际发送
    if (!config.accessKeyId || !config.accessKeySecret) {
      this.logger.warn(`[SMS] 阿里云密钥未配置，模拟发送 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}`);
      return;
    }

    if (!config.signName) {
      this.logger.warn(`[SMS] 短信签名未配置，模拟发送 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}`);
      return;
    }

    if (!templateCode) {
      this.logger.warn(`[SMS] 短信模板未配置，跳过发送 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}`);
      return;
    }

    this.logger.log(`[SMS] 调用阿里云API - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}, 签名: ${config.signName}, 模板: ${templateCode}`);

    // 使用阿里云V2.0 SDK发送短信
    const clientConfig = new $OpenApi.Config({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });
    // Endpoint 请参考 https://api.aliyun.com/product/Dysmsapi
    clientConfig.endpoint = 'dysmsapi.aliyuncs.com';

    const client = new Dysmsapi20170525(clientConfig);

    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode: templateCode,
      templateParam: JSON.stringify({ code }),
    });

    const result = await client.sendSmsWithOptions(sendSmsRequest, new $Util.RuntimeOptions({}));

    this.logger.log(`[SMS] 阿里云响应: ${JSON.stringify(result.body)}`);

    if (result.body?.code !== 'OK') {
      throw new Error(result.body?.message || '短信发送失败');
    }

    this.logger.log(`[SMS] 发送成功 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}`);
  }

  /**
   * HMAC-SHA1签名
   */
  private async hmacSha1(key: string, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBuffer = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return btoa(String.fromCodePoint(...new Uint8Array(signature)));
  }

  /**
   * 发送通知短信（订单通知、饲料费通知等）
   */
  async sendNotification(phone: string, templateType: string, params: Record<string, string>): Promise<void> {
    const config = await this.getSmsConfig();

    if (!config.accessKeyId || !config.accessKeySecret) {
      this.logger.log(`[SMS] 模拟发送通知 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}, 类型: ${templateType}`);
      return;
    }

    // 获取对应类型的模板
    let templateCode: string;
    if (templateType === 'order') {
      templateCode = await this.getConfig('sms_template_order');
    } else if (templateType === 'feed_bill') {
      templateCode = await this.getConfig('sms_template_feed_bill');
    } else {
      throw new BadRequestException('未知的短信模板类型');
    }

    if (!templateCode) {
      this.logger.warn(`[SMS] 未配置${templateType}类型的短信模板，跳过发送`);
      return;
    }

    const smsParams = {
      AccessKeyId: config.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: config.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Date.now().toString(),
      SignatureVersion: '1.0',
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify(params),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25',
    };

    // 构建签名并发送
    const queryString = Object.keys(smsParams)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(smsParams[key as keyof typeof smsParams])}`)
      .join('&');

    const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(queryString)}`;
    const signature = await this.hmacSha1(config.accessKeySecret + '&', stringToSign);

    const response = await fetch('https://dysmsapi.aliyuncs.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${queryString}&Signature=${encodeURIComponent(signature)}`,
    });

    const result = await response.json();

    if (result.Code !== 'OK') {
      this.logger.error(`[SMS] 发送通知失败: ${result.Message}`);
      throw new Error(result.Message || '短信发送失败');
    }

    this.logger.log(`[SMS] 通知发送成功 - 手机: ${phone.substring(0, 3)}****${phone.substring(7)}, 类型: ${templateType}`);
  }
}
