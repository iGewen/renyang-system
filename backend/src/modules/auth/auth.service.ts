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
  UpdateUserDto,
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

    // 调用短信服务发送验证码（频率限制在SmsService中统一处理）
    return this.smsService.sendVerificationCode(phone, type);
  }

  /**
   * 用户注册
   */
  async register(dto: RegisterDto) {
    const { phone, code, password } = dto;

    // 验证验证码
    await this.smsService.verifyCode(phone, code, 'register');

    // 检查用户是否存在
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
      balance: 0,
      status: 1,
    });
    await this.userRepository.save(user);

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'register');

    // 生成token
    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 密码登录
   */
  async loginByPassword(dto: LoginByPasswordDto) {
    const { phone, password } = dto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.phone = :phone', { phone })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 3) {
      throw new UnauthorizedException('您的账号已被封禁，如有疑问请联系客服');
    }

    if (user.status === 2) {
      throw new UnauthorizedException('您的账号受限，暂时无法登录，如有疑问请联系客服');
    }

    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    // 更新最后登录时间
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * 验证码登录
   */
  async loginByCode(dto: LoginByCodeDto) {
    const { phone, code } = dto;

    // 验证验证码
    await this.smsService.verifyCode(phone, code, 'login');

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 3) {
      throw new UnauthorizedException('您的账号已被封禁，如有疑问请联系客服');
    }

    if (user.status === 2) {
      throw new UnauthorizedException('您的账号受限，暂时无法登录，如有疑问请联系客服');
    }

    // 更新最后登录时间
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'login');

    const token = this.generateToken(user);

    return {
      token,
      user: this.sanitizeUser(user),
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
    const hashedPassword = await PasswordUtil.hash(newPassword);
    await this.userRepository.update(user.id, { password: hashedPassword });

    // 标记验证码已使用
    await this.smsService.markCodeUsed(phone, code, 'reset_password');

    return { success: true };
  }

  /**
   * 获取微信授权URL
   */
  async getWechatAuthUrl() {
    const appId = this.configService.get('wechatLogin.appId');
    const redirectUri = encodeURIComponent(`${this.configService.get('app.url')}/api/auth/wechat/callback`);
    const state = CryptoUtil.randomString(16);

    // 存储state
    await this.redisService.set(`wechat:state:${state}`, '1', 600); // 10分钟

    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;

    return { url };
  }

  /**
   * 微信授权回调
   */
  async wechatCallback(code: string, state: string) {
    // 验证state
    const stateKey = `wechat:state:${state}`;
    const stateExists = await this.redisService.get(stateKey);
    if (!stateExists) {
      throw new BadRequestException('无效的授权状态');
    }
    await this.redisService.del(stateKey);

    // TODO: 实现微信授权回调
    throw new BadRequestException('微信登录功能暂未开放');
  }

  /**
   * 绑定手机号
   */
  async bindPhone(dto: BindPhoneDto) {
    // TODO: 实现绑定手机号功能
    throw new BadRequestException('绑定手机号功能暂未开放');
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return this.sanitizeUser(user);
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (dto.nickname) {
      user.nickname = dto.nickname;
    }
    if (dto.avatar) {
      user.avatar = dto.avatar;
    }

    await this.userRepository.save(user);
    return this.sanitizeUser(user);
  }

  /**
   * 验证用户
   */
  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.status === 3) {
      throw new UnauthorizedException('您的账号已被封禁，如有疑问请联系客服');
    }

    if (user.status === 2) {
      throw new UnauthorizedException('您的账号受限，暂时无法登录，如有疑问请联系客服');
    }
    return user;
  }

  /**
   * 清理用户敏感信息
   */
  private sanitizeUser(user: User) {
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
