import { SetMetadata } from '@nestjs/common';

// 管理员角色枚举
export enum AdminRole {
  SUPER_ADMIN = 1,  // 超级管理员
  ADMIN = 2,        // 普通管理员
}

// 管理员角色key
export const ADMIN_ROLE_KEY = 'admin_role';

// 标记接口需要管理员权限的装饰器
export const RequireAdmin = (role?: AdminRole) => SetMetadata(ADMIN_ROLE_KEY, role ?? AdminRole.ADMIN);
