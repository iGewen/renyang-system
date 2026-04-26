import { Controller, Get, Param, NotFoundException, Patch, Body, Put, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig, SmsCode } from '@/entities';
import * as bcrypt from 'bcryptjs';
import { IsString, IsOptional, IsUrl } from 'class-validator';

// DTO for profile update with URL validation for avatar
class UpdateProfileDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsUrl({}, { message: '头像必须是有效的URL格式' })
  @IsOptional()
  avatar?: string;
}

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(SmsCode)
    private readonly smsCodeRepository: Repository<SmsCode>,
  ) {}

  @Get('me')
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.userService.findOne(userId);
  }

  @Patch('me')
  async updateProfile(@CurrentUser('id') userId: string, @Body() body: UpdateProfileDto) {
    return this.userService.updateProfile(userId, body);
  }

  /**
   * 修改密码
   */
  @Put('me/password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    // 修复：显式查询包含 password 字段，因为 User 实体设置了 select: false
    const user = await this.userService.findOneWithPassword(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证原密码
    const isValid = await bcrypt.compare(body.oldPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('原密码错误');
    }

    // 安全修复：验证新密码强度
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
    if (!passwordPattern.test(body.newPassword)) {
      throw new BadRequestException('密码必须包含大小写字母和数字，长度8-20位，可包含特殊字符@$!%*?&');
    }

    if (body.oldPassword === body.newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    await this.userService.updatePassword(userId, hashedPassword);

    return { success: true };
  }

  /**
   * 修改手机号
   */
  @Put('me/phone')
  async changePhone(
    @CurrentUser('id') userId: string,
    @Body() body: { newPhone: string; code: string }
  ) {
    // 安全修复：验证手机号格式
    const phonePattern = /^1[3-9]\d{9}$/;
    if (!phonePattern.test(body.newPhone)) {
      throw new BadRequestException('手机号格式不正确');
    }

    // 安全修复：验证验证码格式
    if (!body.code?.length || body.code.length !== 6 || !/^\d{6}$/.test(body.code)) {
      throw new BadRequestException('验证码格式不正确');
    }

    // 验证验证码
    const smsCode = await this.smsCodeRepository.findOne({
      where: { phone: body.newPhone, code: body.code, type: 'change_phone', isUsed: 0 },
      order: { createdAt: 'DESC' },
    });

    if (!smsCode) {
      throw new BadRequestException('验证码错误或已过期');
    }

    if (new Date() > smsCode.expireAt) {
      throw new BadRequestException('验证码已过期');
    }

    // 检查手机号是否已被使用
    const existingUser = await this.userService.findByPhone(body.newPhone);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('该手机号已被其他用户使用');
    }

    // 使用事务更新手机号和标记验证码
    const result = await this.userService.updatePhoneWithCode(userId, body.newPhone, smsCode.id);

    // 返回更新后的用户信息
    const updatedUser = await this.userService.findOne(userId);
    return {
      success: true,
      user: updatedUser,
      nicknameUpdated: result.nicknameUpdated
    };
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
      'contact_wechat',
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
    // 直接使用前端传入的type作为key，与后台管理保存的key保持一致
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: type, configType: 'agreement' },
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
