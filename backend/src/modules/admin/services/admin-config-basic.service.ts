import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SystemConfig } from '@/entities';
import { AdminService } from '../admin.service';
import { RedisService } from '@/common/utils/redis.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { IdUtil } from '@/common/utils/id.util';
import { AlipayService } from '@/services/alipay.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { SmsService } from '@/services/sms.service';

@Injectable()
export class AdminConfigBasicService {
  private readonly logger = new Logger(AdminConfigBasicService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly configService: ConfigService,
    private readonly adminService: AdminService,
    private readonly redisService: RedisService,
    private readonly alipayService: AlipayService,
    private readonly wechatPayService: WechatPayService,
    private readonly smsService: SmsService,
  ) {}

  // 安全修复：系统配置键白名单
  private readonly SYSTEM_CONFIG_ALLOWED_KEYS = [
    // 基础配置
    'site_name', 'site_title', 'site_logo', 'site_description', 'site_keywords',
    'contact_phone', 'contact_email', 'contact_address', 'contact_wechat',
    // 支付配置
    'alipay_app_id', 'alipay_private_key', 'alipay_public_key', 'alipay_notify_url',
    'alipay_return_url',
    'wechat_app_id', 'wechat_mch_id', 'wechat_api_key', 'wechat_notify_url',
    'wechat_pay_key', 'wechat_api_v3_key', 'wechat_serial_no', 'wechat_private_key',
    'wechat_template_adoption_success', 'wechat_template_feed_bill', 'wechat_template_feed_bill_overdue',
    'wechat_template_redemption_audit', 'wechat_template_redemption_success',
    'payment_alipay_enabled', 'payment_wechat_enabled',
    // 短信配置
    'aliyun_access_key_id', 'aliyun_access_key_secret', 'aliyun_sign_name', 'aliyun_template_code',
    'sms_enabled', 'sms_daily_limit',
    'sms_template_login', 'sms_template_register', 'sms_template_reset_password',
    'sms_template_order', 'sms_template_feed_bill',
    // 功能配置
    'order_expire_minutes', 'feed_fee_rate', 'late_fee_rate', 'late_fee_cap_rate', 'late_fee_start_days',
    'redemption_fee_rate', 'max_adoptions_per_user', 'balance_min_recharge', 'balance_max_balance',
    // 其他配置
    'user_agreement', 'adoption_agreement', 'privacy_policy', 'disclaimer', 'about_us', 'faq',
  ];

  /**
   * 获取系统配置
   */
  async getSystemConfig(configType?: string) {
    const where: any = {};
    if (configType) {
      where.configType = configType;
    }

    const configs = await this.systemConfigRepository.find({ where });

    return configs.map(config => ({
      id: config.id,
      configKey: config.configKey,
      configValue: config.isEncrypted ? this.decrypt(config.configValue) : config.configValue,
      configType: config.configType,
      description: config.description,
      isEncrypted: config.isEncrypted === 1,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(configKey: string, configValue: any, adminId: string, adminName: string, _ip?: string) {
    if (!this.SYSTEM_CONFIG_ALLOWED_KEYS.includes(configKey)) {
      throw new BadRequestException(`不支持的配置项: ${configKey}。请联系开发人员添加新的配置键。`);
    }

    let config = await this.systemConfigRepository.findOne({
      where: { configKey },
    });

    const valueStr = typeof configValue === 'string'
      ? configValue
      : JSON.stringify(configValue);

    const getConfigType = (key: string): string => {
      if (key.startsWith('site_') || key.startsWith('contact_')) return 'basic';
      if (key.startsWith('alipay_') || key.startsWith('wechat_')) return 'payment';
      if (key.startsWith('aliyun_') || key.startsWith('sms_')) return 'sms';
      return 'other';
    };

    const configType = getConfigType(configKey);

    if (config) {
      const beforeData = config.configValue;
      config.configValue = valueStr;
      config.configType = configType;
      await this.systemConfigRepository.save(config);

      await this.adminService.createAuditLog({
        adminId,
        adminName,
        module: 'system_config',
        action: 'update',
        targetType: 'system_config',
        targetId: config.id,
        beforeData: { value: beforeData },
        afterData: { value: valueStr },
        remark: `更新配置: ${configKey}`,
        isSensitive: 1,
      });
    } else {
      config = this.systemConfigRepository.create({
        id: IdUtil.generate('SC'),
        configKey,
        configValue: valueStr,
        configType,
      });
      await this.systemConfigRepository.save(config);

      await this.adminService.createAuditLog({
        adminId,
        adminName,
        module: 'system_config',
        action: 'create',
        targetType: 'system_config',
        targetId: config.id,
        afterData: { key: configKey, value: valueStr },
        remark: `创建配置: ${configKey}`,
      });
    }

    await this.redisService.set(`system:config:${configKey}`, valueStr);

    return { success: true };
  }

  /**
   * 测试支付配置
   */
  async testPayment(type: 'alipay' | 'wechat'): Promise<{ success: boolean; message: string }> {
    try {
      if (type === 'alipay') {
        const [appId, privateKey, alipayPublicKey] = await Promise.all([
          this.getConfig('alipay_app_id'),
          this.getConfig('alipay_private_key'),
          this.getConfig('alipay_public_key'),
        ]);

        if (!appId || !privateKey || !alipayPublicKey) {
          return { success: false, message: '支付宝配置不完整，请检查AppId、私钥和公钥' };
        }

        if (appId.length < 10) {
          return { success: false, message: '支付宝AppId格式不正确' };
        }

        return { success: true, message: '支付宝配置验证通过' };
      } else if (type === 'wechat') {
        const [appId, mchId, apiKey] = await Promise.all([
          this.getConfig('wechat_app_id'),
          this.getConfig('wechat_mch_id'),
          this.getConfig('wechat_api_key'),
        ]);

        if (!appId || !mchId || !apiKey) {
          return { success: false, message: '微信支付配置不完整，请检查AppId、商户号和API密钥' };
        }

        return { success: true, message: '微信支付配置验证通过' };
      }

      return { success: false, message: '不支持的支付类型' };
    } catch (error: any) {
      return { success: false, message: `测试失败: ${error.message}` };
    }
  }

  /**
   * 测试短信配置
   */
  async testSms(phone: string): Promise<{ success: boolean; message: string }> {
    try {
      const [accessKeyId, accessKeySecret, signName] = await Promise.all([
        this.getConfig('aliyun_access_key_id'),
        this.getConfig('aliyun_access_key_secret'),
        this.getConfig('aliyun_sign_name'),
      ]);

      if (!accessKeyId || !accessKeySecret || !signName) {
        return { success: false, message: '短信配置不完整，请检查AccessKeyId、AccessKeySecret和签名' };
      }

      await this.smsService.sendVerificationCode(phone, 'login');

      return { success: true, message: `测试短信已发送到 ${phone}` };
    } catch (error: any) {
      return { success: false, message: `测试失败: ${error.message}` };
    }
  }

  /**
   * 获取配置（内部方法）
   */
  private async getConfig(key: string): Promise<string> {
    const cacheKey = `system:config:${key}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key },
    });

    const value = config?.configValue || '';
    await this.redisService.set(cacheKey, value, 300);
    return value;
  }

  /**
   * AES加密敏感配置
   */
  private encrypt(text: string): string {
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY 未配置或长度不足32位，请检查环境变量');
    }
    return CryptoUtil.aesEncrypt(text, key);
  }

  /**
   * AES解密敏感配置
   */
  private decrypt(text: string): string {
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY 未配置或长度不足32位，请检查环境变量');
    }
    try {
      return CryptoUtil.aesDecrypt(text, key);
    } catch {
      return Buffer.from(text, 'base64').toString();
    }
  }
}
