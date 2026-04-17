import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '@/entities';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
  ) {}

  @Get('me')
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.userService.findOne(userId);
  }

  @Get('me/balance-logs')
  async getBalanceLogs(@CurrentUser('id') userId: string) {
    return this.userService.getBalanceLogs(userId);
  }

  // =============== 公开配置接口 ===============

  /**
   * 获取站点配置（公开接口，无需登录）
   */
  @Public()
  @Get('site-config')
  async getSiteConfig() {
    const keys = [
      'site_name',
      'site_title',
      'site_description',
      'site_keywords',
      'contact_phone',
      'contact_email',
    ];

    const configs = await this.systemConfigRepository.find({
      where: keys.map(key => ({ configKey: key })),
    });

    const result: Record<string, string> = {};
    configs.forEach(config => {
      result[config.configKey] = config.configValue || '';
    });

    return result;
  }

  /**
   * 获取支付配置（公开接口，返回哪些支付方式启用）
   */
  @Public()
  @Get('payment-config')
  async getPaymentConfig() {
    const configs = await this.systemConfigRepository.find({
      where: [
        { configKey: 'payment_alipay_enabled' },
        { configKey: 'payment_wechat_enabled' },
      ],
    });

    const result = {
      alipay_enabled: true,
      wechat_enabled: true,
    };

    configs.forEach(config => {
      if (config.configKey === 'payment_alipay_enabled') {
        result.alipay_enabled = config.configValue === 'true';
      }
      if (config.configKey === 'payment_wechat_enabled') {
        result.wechat_enabled = config.configValue === 'true';
      }
    });

    return result;
  }

  // =============== 协议接口 ===============

  /**
   * 获取协议内容
   */
  @Public()
  @Get('agreements/:type')
  async getAgreement(@Param('type') type: string) {
    const agreementKeyMap: Record<string, string> = {
      'user': 'user_agreement',
      'adoption': 'adoption_agreement',
      'privacy': 'privacy_policy',
      'disclaimer': 'disclaimer',
    };

    const key = agreementKeyMap[type] || type;
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key, configType: 'agreement' },
    });

    if (!config) {
      throw new NotFoundException('协议不存在');
    }

    return {
      title: config.description || config.configKey,
      content: config.configValue,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 获取所有协议列表
   */
  @Public()
  @Get('agreements')
  async getAgreementList() {
    const configs = await this.systemConfigRepository.find({
      where: { configType: 'agreement' },
      order: { createdAt: 'ASC' },
    });

    return configs.map(config => ({
      key: config.configKey,
      title: config.description || config.configKey,
      updatedAt: config.updatedAt,
    }));
  }
}
