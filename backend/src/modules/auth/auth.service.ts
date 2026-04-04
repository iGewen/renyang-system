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

    // 生成验证码
    const code = CryptoUtil.randomDigits(6);

    // 存储验证码到数据库
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    const smsCode = this.smsCodeRepository.create({
      phone,
      code,
      type,
      expireAt,
    });
    await this.smsCodeRepository.save(smsCode);

    // 存储验证码到Redis（用于快速验证）
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.set(codeKey, code, 300); // 5分钟

    // 设置发送频率限制
    await this.redisService.set(limitKey, '1', 60); // 60秒

    // TODO: 调用阿里云短信服务发送验证码
    console.log(`[SMS] 发送验证码到 ${phone}: ${code} (类型: ${type})`);

    return { success: true };
  }

  /**
   * 用户注册
   */
  async register(dto: RegisterDto) {
    const { phone, code, password } = dto;

    // 验证验证码
    await this.verifyCode(phone, code, 'register');

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
    await this.markCodeUsed(phone, code, 'register');

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

    if (user.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
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
    await this.verifyCode(phone, code, 'login');

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    // 更新最后登录时间
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    // 标记验证码已使用
    await this.markCodeUsed(phone, code, 'login');

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
    await this.verifyCode(phone, code, 'reset_password');

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 更新密码
    const hashedPassword = await PasswordUtil.hash(newPassword);
    await this.userRepository.update(user.id, { password: hashedPassword });

    // 标记验证码已使用
    await this.markCodeUsed(phone, code, 'reset_password');

    return { success: true };
  }

  /**
   * 获取微信授权URL
   */
  async getWechatAuthUrl() {
    // TODO: 实现微信授权URL生成
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
    // TODO: 实现微信授权回调
    throw new BadRequestException('微信登录功能暂未开放');
  }

  /**
   * 绑定手机号
   */
  async bindPhone(dto: BindPhoneDto) {
    const { tempToken, phone, code } = dto;

    // 验证临时token
    const tempData = await this.redisService.get(`wechat:temp:${tempToken}`);
    if (!tempData) {
      throw new BadRequestException('临时token已过期，请重新授权');
    }

    // 验证验证码
    await this.verifyCode(phone, code, 'register');

    // TODO: 创建或绑定用户

    return {
      token: 'token',
      user: {},
    };
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
  async updateUser(userId: string, dto: { nickname?: string; avatar?: string }) {
    await this.userRepository.update(userId, dto);
    return this.getCurrentUser(userId);
  }

  /**
   * 验证验证码
   */
  private async verifyCode(phone: string, code: string, type: string) {
    // 从Redis获取验证码
    const codeKey = `sms:code:${phone}:${type}`;
    const storedCode = await this.redisService.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('验证码已过期');
    }

    if (storedCode !== code) {
      throw new BadRequestException('验证码错误');
    }
  }

  /**
   * 标记验证码已使用
   */
  private async markCodeUsed(phone: string, code: string, type: string) {
    // 删除Redis中的验证码
    const codeKey = `sms:code:${phone}:${type}`;
    await this.redisService.del(codeKey);

    // 更新数据库中的验证码状态
    await this.smsCodeRepository.update(
      { phone, code, type, isUsed: 0 },
      { isUsed: 1 }
    );
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

  /**
   * 移除敏感信息
   */
  private sanitizeUser(user: User) {
    const { password, ...result } = user;
    return result;
  }

  /**
   * 验证JWT Token
   */
  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== 1) {
      return null;
    }
    return user;
  }
}
