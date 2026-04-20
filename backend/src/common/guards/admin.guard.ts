import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLE_KEY, AdminRole } from '../decorators/admin-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '@/entities/admin.entity';
import { RedisService } from '../utils/redis.service';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  // 管理员信息缓存时间（5分钟）
  private readonly ADMIN_CACHE_TTL = 300;

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly redisService: RedisService,
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

    // 修复 B-QUAL-008：使用 Redis 缓存管理员信息，减少数据库查询
    const cacheKey = `admin:info:${user.id}`;
    let admin: Admin | null = null;

    try {
      const cachedAdmin = await this.redisService.get(cacheKey);
      if (cachedAdmin) {
        admin = JSON.parse(cachedAdmin);
      }
    } catch (error) {
      this.logger.warn(`[AdminGuard] 缓存读取失败: ${error.message}`);
    }

    // 缓存未命中，从数据库获取
    if (!admin) {
      admin = await this.adminRepository.findOne({
        where: { id: user.id },
      });

      if (admin) {
        // 缓存管理员信息
        try {
          await this.redisService.set(
            cacheKey,
            JSON.stringify({
              id: admin.id,
              status: admin.status,
              role: admin.role,
            }),
            this.ADMIN_CACHE_TTL
          );
        } catch (error) {
          this.logger.warn(`[AdminGuard] 缓存写入失败: ${error.message}`);
        }
      }
    }

    if (!admin) {
      this.logger.warn(`[AdminGuard] 非管理员尝试访问: userId=${user.id}`);
      throw new ForbiddenException('无权访问管理接口');
    }

    // 检查管理员状态
    if (admin.status !== 1) {
      this.logger.warn(`[AdminGuard] 管理员账号已禁用: adminId=${admin.id}`);
      throw new ForbiddenException('管理员账号已被禁用');
    }

    // 检查角色权限
    if (minRole === AdminRole.SUPER_ADMIN && admin.role !== AdminRole.SUPER_ADMIN) {
      this.logger.warn(`[AdminGuard] 权限不足: adminId=${admin.id}, required=SUPER_ADMIN, actual=${admin.role}`);
      throw new ForbiddenException('需要超级管理员权限');
    }

    // 将管理员信息附加到请求对象
    request.admin = admin;

    return true;
  }
}
