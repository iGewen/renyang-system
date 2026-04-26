import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adoption, AdoptionStatus, AuditLog } from '@/entities';
import { AdminService } from '../admin.service';
import { normalizePagination } from '@/common/utils/pagination.util';

@Injectable()
export class AdminAdoptionService {
  constructor(
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly adminService: AdminService,
  ) {}

  // =============== 领养管理 ===============

  /**
   * 获取领养列表
   */
  async getAdoptionList(params: {
    page: number;
    pageSize: number;
    status?: AdoptionStatus;
    keyword?: string;
  }) {
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);
    const queryBuilder = this.adoptionRepository.createQueryBuilder('adoption')
      .leftJoinAndSelect('adoption.user', 'user')
      .leftJoinAndSelect('adoption.livestock', 'livestock');

    if (params.status !== undefined) {
      queryBuilder.andWhere('adoption.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere(
        '(adoption.adoptionNo LIKE :keyword OR user.phone LIKE :keyword OR user.nickname LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    queryBuilder
      .orderBy('adoption.createdAt', 'DESC')
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
   * 获取领养详情
   */
  async getAdoptionDetail(adoptionId: string) {
    const adoption = await this.adoptionRepository.findOne({
      where: { id: adoptionId },
      relations: ['user', 'livestock', 'feedBills'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    return adoption;
  }

  /**
   * 获取异常领养列表
   */
  async getExceptionAdoptions(params: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.adoptionRepository.findAndCount({
      where: { isException: 1 },
      relations: ['user', 'livestock'],
      order: { exceptionAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 处理异常领养
   */
  async resolveException(adoptionId: string, action: 'contact' | 'terminate' | 'continue', _remark: string) {
    const adoption = await this.adoptionRepository.findOne({ where: { id: adoptionId } });
    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    switch (action) {
      case 'contact':
        // 仅记录，不做状态变更
        break;
      case 'terminate':
        adoption.status = AdoptionStatus.TERMINATED;
        break;
      case 'continue':
        adoption.status = AdoptionStatus.ACTIVE;
        adoption.isException = 0;
        adoption.exceptionReason = null as any;
        adoption.exceptionAt = null as any;
        break;
    }

    await this.adoptionRepository.save(adoption);
    return adoption;
  }
}
