import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Livestock, LivestockType, Adoption, AdoptionStatus, AuditLog } from '@/entities';
import { IdUtil } from '@/common/utils/id.util';
import { AdminService } from '../admin.service';
import { normalizePagination } from '@/common/utils/pagination.util';

@Injectable()
export class AdminLivestockService {
  constructor(
    @InjectRepository(Livestock)
    private readonly livestockRepository: Repository<Livestock>,
    @InjectRepository(LivestockType)
    private readonly livestockTypeRepository: Repository<LivestockType>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly adminService: AdminService,
  ) {}

  // =============== 活体类型管理 ===============

  /**
   * 获取活体类型列表
   */
  async getLivestockTypeList() {
    return this.livestockTypeRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * 创建活体类型
   */
  async createLivestockType(data: Partial<LivestockType>, adminId: string, adminName: string, ip?: string) {
    const type = this.livestockTypeRepository.create({
      id: IdUtil.generate('LT'),
      ...data,
    });

    await this.livestockTypeRepository.save(type);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'create',
      targetType: 'livestock_type',
      targetId: type.id,
      afterData: type,
      remark: '创建活体类型',
      ip,
    });

    return type;
  }

  /**
   * 更新活体类型
   */
  async updateLivestockType(id: string, data: Partial<LivestockType>, adminId: string, adminName: string, ip?: string) {
    const type = await this.livestockTypeRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException('活体类型不存在');
    }

    const beforeData = { ...type };
    Object.assign(type, data);
    await this.livestockTypeRepository.save(type);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'update',
      targetType: 'livestock_type',
      targetId: id,
      beforeData,
      afterData: type,
      remark: '更新活体类型',
      ip,
    });

    return type;
  }

  /**
   * 删除活体类型
   */
  async deleteLivestockType(id: string, adminId: string, adminName: string, ip?: string) {
    const type = await this.livestockTypeRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException('活体类型不存在');
    }

    // 检查是否有关联的活体
    const livestockCount = await this.livestockRepository.count({
      where: { typeId: id },
    });

    if (livestockCount > 0) {
      throw new BadRequestException('该类型下有活体，无法删除');
    }

    await this.livestockTypeRepository.remove(type);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'delete',
      targetType: 'livestock_type',
      targetId: id,
      beforeData: type,
      remark: '删除活体类型',
      ip,
    });

    return { success: true };
  }

  // =============== 活体管理 ===============

  /**
   * 获取活体列表
   */
  async getLivestockList(params: {
    page: number;
    pageSize: number;
    typeId?: string;
    status?: number;
    keyword?: string;
  }) {
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);
    const queryBuilder = this.livestockRepository.createQueryBuilder('livestock')
      .leftJoinAndSelect('livestock.type', 'type');

    if (params.typeId) {
      queryBuilder.andWhere('livestock.typeId = :typeId', { typeId: params.typeId });
    }

    if (params.status !== undefined) {
      queryBuilder.andWhere('livestock.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere('livestock.name LIKE :keyword', { keyword: `%${params.keyword}%` });
    }

    queryBuilder
      .orderBy('livestock.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 创建活体
   */
  async createLivestock(data: Partial<Livestock>, adminId: string, adminName: string, ip?: string) {
    const livestock = this.livestockRepository.create({
      id: IdUtil.generate('L'),
      livestockNo: IdUtil.generateLivestockNo(), // 活体编号 = 领养编号
      ...data,
    });

    await this.livestockRepository.save(livestock);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'create',
      targetType: 'livestock',
      targetId: livestock.id,
      afterData: livestock,
      remark: '创建活体',
      ip,
    });

    return livestock;
  }

  /**
   * 更新活体
   */
  async updateLivestock(id: string, data: Partial<Livestock>, adminId: string, adminName: string, ip?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    const beforeData = { ...livestock };
    Object.assign(livestock, data);
    await this.livestockRepository.save(livestock);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'update',
      targetType: 'livestock',
      targetId: id,
      beforeData,
      afterData: livestock,
      remark: '更新活体',
      ip,
    });

    return livestock;
  }

  /**
   * 更新活体状态
   */
  async updateLivestockStatus(id: string, status: number, adminId: string, adminName: string, ip?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    const beforeData = { status: livestock.status };
    await this.livestockRepository.update(id, { status });

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'update_status',
      targetType: 'livestock',
      targetId: id,
      beforeData,
      afterData: { status },
      remark: `更新活体状态为: ${status}`,
      ip,
    });

    return { success: true };
  }

  /**
   * 删除活体
   * 安全修复：删除前检查是否有活跃认养
   */
  async deleteLivestock(id: string, adminId: string, adminName: string, ip?: string, userAgent?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    // 安全修复：检查是否有进行中的认养
    const activeAdoptionCount = await this.adoptionRepository.count({
      where: {
        livestockId: id,
        status: In([AdoptionStatus.ACTIVE, AdoptionStatus.FEED_OVERDUE, AdoptionStatus.REDEEMABLE, AdoptionStatus.REDEMPTION_PENDING]),
      },
    });

    if (activeAdoptionCount > 0) {
      throw new BadRequestException(`该活体有 ${activeAdoptionCount} 个进行中的认养，无法删除`);
    }

    // 软删除
    await this.livestockRepository.softDelete(id);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'delete',
      targetType: 'livestock',
      targetId: id,
      beforeData: livestock,
      remark: '删除活体',
      ip,
      userAgent,
    });

    return { success: true };
  }
}
