import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RedisService } from '@/common/utils/redis.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
      passReqToCallback: true, // 安全修复 S-03：传递 request 以获取原始 token
    } as any); // 类型断言以兼容 passport-jwt 类型定义
  }

  async validate(req: Request, payload: any) {
    const { sub: userId, username, type, role } = payload;

    // 安全修复 S-03：检查 Token 是否在黑名单中
    const token = this.extractToken(req);
    if (token) {
      const isBlacklisted = await this.redisService.exists(`token:blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('登录已失效，请重新登录');
      }
    }

    // 如果是管理员token，返回管理员信息
    if (type === 'admin') {
      return { id: userId, username, type: 'admin', role };
    }

    const user = await this.authService.validateUser(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      balance: user.balance,
      status: user.status,
      type: 'user',
    };
  }

  /**
   * 从请求头提取原始 token
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
