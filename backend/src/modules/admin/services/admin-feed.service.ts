import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FeedBill, FeedBillStatus, AuditLog } from '@/entities';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminFeedService {
  constructor(
    @InjectRepository(FeedBill)
    private readonly feedBillRepository: Repository<FeedBill>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly adminService: AdminService,
  ) {}

  // =============== 饲料费管理 ===============

  /**
   * 获取饲料费账单列表
   */
  async getFeedBillList(params: {
    page: number;
    pageSize: number;
    status?: FeedBillStatus;
    keyword?: string;
  }) {
    const queryBuilder = this.feedBillRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.adoption', 'adoption')
      .leftJoinAndSelect('bill.livestock', 'livestock')
      .leftJoinAndSelect('adoption.user', 'user');

    if (params.status !== undefined) {
      queryBuilder.andWhere('bill.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere(
        '(bill.billNo LIKE :keyword OR user.phone LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    queryBuilder
      .orderBy('bill.createdAt', 'DESC')
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
   * 调整饲料费账单金额
   */
  async adjustFeedBill(billId: string, adjustedAmount: number, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.adjustedAmount = adjustedAmount;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;

    await this.feedBillRepository.save(bill);
    return bill;
  }

  /**
   * 免除饲料费
   */
  async waiveFeedBill(billId: string, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.status = FeedBillStatus.WAIVED;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;
    bill.paidAmount = 0;

    await this.feedBillRepository.save(bill);
    return bill;
  }

  /**
   * 免除滞纳金
   */
  async waiveLateFee(billId: string, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.lateFeeAmount = 0;
    bill.totalLateFee = 0;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;

    await this.feedBillRepository.save(bill);
    return bill;
  }
}
