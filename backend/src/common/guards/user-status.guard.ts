import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@/entities/user.entity';

// 重新导出 UserStatus，方便其他模块使用
export { UserStatus } from '@/entities/user.entity';

// 定义需要的最小状态级别
export const MIN_STATUS_KEY = 'min_status';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取接口要求的最小状态级别
    const minStatus = this.reflector.getAllAndOverride<UserStatus>(
      MIN_STATUS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置状态要求，默认允许
    if (minStatus === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    // 封禁用户完全禁止访问
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('您的账号已被封禁，如有疑问请联系客服');
    }

    // 受限用户只能访问基础接口
    if (user.status === UserStatus.RESTRICTED && minStatus > UserStatus.RESTRICTED) {
      throw new ForbiddenException('您的账号受限，暂时无法进行此操作，如有疑问请联系客服');
    }

    return true;
  }
}
