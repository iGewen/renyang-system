import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLE_KEY, AdminRole } from '../decorators/admin-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '@/entities/admin.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否是公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取接口要求的管理员角色
    const requiredRole = this.reflector.getAllAndOverride<AdminRole>(
      ADMIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置角色要求，默认需要管理员权限
    const minRole = requiredRole ?? AdminRole.ADMIN;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 检查用户是否登录
    if (!user) {
      throw new UnauthorizedException('请先登录');
    }

    // 检查是否是管理员（通过检查admins表）
    const admin = await this.adminRepository.findOne({
      where: { id: user.sub || user.id },
    });

    if (!admin) {
      throw new ForbiddenException('无权访问管理接口');
    }

    // 检查管理员状态
    if (admin.status !== 1) {
      throw new ForbiddenException('管理员账号已被禁用');
    }

    // 检查角色权限
    if (minRole === AdminRole.SUPER_ADMIN && admin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('需要超级管理员权限');
    }

    // 将管理员信息附加到请求对象
    request.admin = admin;

    return true;
  }
}
