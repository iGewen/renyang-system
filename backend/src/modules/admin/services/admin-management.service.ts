import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin, AuditLog } from '@/entities';
import { AdminService } from '../admin.service';
import { IdUtil } from '@/common/utils/id.util';
import { normalizePagination } from '@/common/utils/pagination.util';

@Injectable()
export class AdminManagementService {
  private readonly logger = new Logger(AdminManagementService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly adminService: AdminService,
  ) {}

  /**
   * 获取管理员列表
   */
  async getAdminList(page: number = 1, pageSize: number = 20) {
    const { page: normalizedPage, pageSize: normalizedPageSize, skip } = normalizePagination(page, pageSize);
    const [list, total] = await this.adminRepository.findAndCount({
      select: ['id', 'username', 'name', 'phone', 'avatar', 'role', 'status', 'lastLoginAt', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip,
      take: normalizedPageSize,
    });

    return {
      list,
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalPages: Math.ceil(total / normalizedPageSize),
    };
  }

  /**
   * 创建管理员
   */
  async createAdmin(data: { username: string; password: string; name?: string; phone?: string; role: number }, adminId: string, adminName: string, ip?: string) {
    const existing = await this.adminRepository.findOne({
      where: { username: data.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const admin = this.adminRepository.create({
      id: IdUtil.generate('A'),
      ...data,
      password: hashedPassword,
    });

    await this.adminRepository.save(admin);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'admin',
      action: 'create',
      targetType: 'admin',
      targetId: admin.id,
      afterData: { username: admin.username, name: admin.name, role: admin.role },
      remark: '创建管理员',
      isSensitive: 1,
      ip,
    });

    return {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    };
  }

  /**
   * 更新管理员状态
   */
  async updateAdminStatus(targetAdminId: string, status: number, adminId: string, adminName: string, ip?: string) {
    const admin = await this.adminRepository.findOne({ where: { id: targetAdminId } });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    if (targetAdminId === adminId) {
      throw new BadRequestException('不能禁用自己的账号');
    }

    await this.adminRepository.update(targetAdminId, { status });

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'admin',
      action: 'update_status',
      targetType: 'admin',
      targetId: targetAdminId,
      beforeData: { status: admin.status },
      afterData: { status },
      remark: `更新管理员状态为: ${status === 1 ? '启用' : '禁用'}`,
      ip,
    });

    return { success: true };
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(params: {
    page: number;
    pageSize: number;
    module?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (params.module) {
      queryBuilder.andWhere('log.module = :module', { module: params.module });
    }

    if (params.adminId) {
      queryBuilder.andWhere('log.adminId = :adminId', { adminId: params.adminId });
    }

    if (params.startDate && params.endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 清空审计日志
   */
  async clearAuditLogs(adminId: string, adminName: string, ip?: string, userAgent?: string) {
    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'audit_log',
      action: 'clear',
      targetType: 'audit_log',
      remark: '清空审计日志',
      isSensitive: 1,
      ip,
      userAgent,
    });

    await this.auditLogRepository.clear();

    return { success: true };
  }
}
