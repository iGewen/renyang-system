import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '@/entities/user.entity';
import { SmsCode } from '@/entities/sms-code.entity';
import { PasswordUtil } from '@/common/utils/password.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { SmsService } from '@/services/sms.service';
import {
  SendSmsCodeDto,
  RegisterDto,
  LoginByPasswordDto,
  LoginByCodeDto,
  ResetPasswordDto,
  BindPhoneDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SmsCode)
    private smsCodeRepository: Repository<SmsCode>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private smsService: SmsService,
  ) {}

  /**
   * 发送短信验证码
   */
  async sendSmsCode(dto: SendSmsCodeDto): Promise<{ success: boolean }> {
    const { phone, type } = dto;

    // 检查发送频率限制
    const limitKey = `sms:limit:${phone}`;
    const exists = await this.redisService.exists(limitKey);
    if (exists) {
      throw new BadRequestException('验证码发送过于频繁，请60秒后重试');
    }

    // 检查用户是否存在
    if (type === 'register') {
      const existUser = await this.userRepository.findOne({ where: { phone } });
      if (existUser) {
        throw new BadRequestException('该手机号已注册');
      }
    } else if (type === 'login' || type === 'reset_password') {
      const existUser = await this.userRepository.findOne({ where: { phone } });
      if (!existUser) {
        throw new BadRequestException('该手机号未注册');
      }
    }

    // 调用短信服务发送验证码
    return this.smsService.sendVerificationCode(phone, type);
  }

  /**
   * 用户注册
   */
  async register(dto: RegisterDto) {
    const { phone, code, password } = dto;

    // 验证验证码
    await this.smsService.verifyCode(phone, code, 'register');

    // 检查用户是否已存在
    const existUser = await this.userRepository.findOne({ where: { phone } });
    if (existUser) {
      throw new BadRequestException('该手机号已注册');
    }

    // 创建用户
    const hashedPassword = await PasswordUtil.hash(password);
    const user = this.userRepository.create({
      id: IdUtil.generate('U'),
      phone,
      password: hashedPassword,
      nickname: `用户${phone.slice(-4)}`,
    });

    await this.userRepository.save(user);

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'register');

    // 生成token
    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        balance: user.balance,
      },
    };
  }

  /**
   * 密码登录
   */
  async loginByPassword(dto: LoginByPasswordDto) {
    const { phone, password } = dto;

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (user.status === 'banned') {
      throw new BadRequestException('账号已被封禁');
    }

    const isValid = await PasswordUtil.verify(password, user.password);
    if (!isValid) {
      throw new BadRequestException('密码错误');
    }

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        balance: user.balance,
      },
    };
  }

  /**
   * 验证码登录
   */
  async loginByCode(dto: LoginByCodeDto) {
    const { phone, code } = dto;

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (user.status === 'banned') {
      throw new BadRequestException('账号已被封禁');
    }

    // 验证验证码
    await this.smsService.verifyCode(phone, code, 'login');

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'login');

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        balance: user.balance,
      },
    };
  }

  /**
   * 重置密码
   */
  async resetPassword(dto: ResetPasswordDto) {
    const { phone, code, newPassword } = dto;

    // 验证验证码
    await this.smsService.verifyCode(phone, code, 'reset_password');

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 更新密码
    user.password = await PasswordUtil.hash(newPassword);
    await this.userRepository.save(user);

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'reset_password');

    return { success: true };
  }

  /**
   * 微信登录
   */
  async wechatLogin(code: string) {
    // TODO: 实现微信登录
    throw new BadRequestException('微信登录暂未开放');
  }

  /**
   * 绑定手机号
   */
  async bindPhone(dto: BindPhoneDto) {
    // TODO: 实现绑定手机号
    throw new BadRequestException('绑定手机号暂未开放');
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      balance: user.balance,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * 生成JWT Token
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      type: 'user',
    };

    return this.jwtService.sign(payload);
  }
}
