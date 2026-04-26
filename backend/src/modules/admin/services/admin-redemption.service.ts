import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedemptionOrder, Adoption, AuditLog } from '@/entities';
import { NotificationService } from '../../notification/notification.service';
import { AdminService } from '../admin.service';

@Injectable()
export class AdminRedemptionService {
  private readonly logger = new Logger(AdminRedemptionService.name);

  constructor(
    @InjectRepository(RedemptionOrder)
    private readonly redemptionOrderRepository: Repository<RedemptionOrder>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly dataSource: DataSource,
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 获取买断订单列表
   */
  async getRedemptionList(params: {
    page: number;
    pageSize: number;
    status?: number;
  }) {
    const queryBuilder = this.redemptionOrderRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.user', 'user')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.adoption', 'adoption');

    if (params.status !== undefined) {
      queryBuilder.andWhere('redemption.status = :status', { status: params.status });
    }

    queryBuilder
      .orderBy('redemption.createdAt', 'DESC')
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
   * 获取买断订单详情
   */
  async getRedemptionDetail(id: string) {
    const redemption = await this.redemptionOrderRepository.findOne({
      where: { id },
      relations: ['user', 'livestock', 'adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断订单不存在');
    }

    return redemption;
  }

  /**
   * 审核买断申请
   */
  async auditRedemption(
    id: string,
    approved: boolean,
    adjustedAmount: number | undefined,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    const redemption = await this.redemptionOrderRepository.findOne({
      where: { id },
      relations: ['adoption'],
    });
    if (!redemption) {
      throw new NotFoundException('买断订单不存在');
    }

    if (redemption.status !== 1) {
      throw new BadRequestException('该买断申请不在待审核状态');
    }

    const beforeData = { status: redemption.status };
    redemption.status = approved ? 2 : 3; // 2: 审核通过, 3: 审核拒绝

    if (approved && adjustedAmount !== undefined) {
      redemption.adjustedAmount = adjustedAmount;
      redemption.finalAmount = adjustedAmount;
    }

    if (remark) {
      redemption.auditRemark = remark;
    }

    redemption.auditAdminId = adminId;
    redemption.auditAt = new Date();

    await this.redemptionOrderRepository.save(redemption);

    // 如果审核拒绝，恢复领养状态
    if (!approved && redemption.adoption) {
      redemption.adoption.status = 1; // 恢复为领养中
      await this.adoptionRepository.save(redemption.adoption);
    }

    // 发送站内信通知用户
    try {
      // 构建通知内容
      const amountStr = adjustedAmount === undefined ? `金额：¥${redemption.finalAmount}` : `调整后金额：¥${adjustedAmount}`;
      const approvedContent = `您的买断申请（编号：${redemption.redemptionNo}）已通过审核，请尽快完成支付。${amountStr}`;
      const remarkText = remark ? `原因：${remark}` : '';
      const rejectedContent = `您的买断申请（编号：${redemption.redemptionNo}）未通过审核。${remarkText}`;

      await this.notificationService.createNotification({
        userId: redemption.userId,
        title: approved ? '买断申请已通过' : '买断申请已拒绝',
        content: approved ? approvedContent : rejectedContent,
        type: 'redemption',
        relatedType: 'redemption',
        relatedId: redemption.id,
      });
    } catch (error) {
      this.logger.error('发送买断审核通知失败', error);
    }

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'redemption',
      action: approved ? 'approve' : 'reject',
      targetType: 'redemption',
      targetId: id,
      beforeData,
      afterData: { status: redemption.status, adjustedAmount, remark },
      remark: approved ? '审核通过买断申请' : '审核拒绝买断申请',
      ip,
    });

    // 审核通过时，发射事件以调度12小时后自动取消延迟任务
    if (approved) {
      this.eventEmitter.emit('redemption.audit-passed', { redemptionId: redemption.id });
    }

    return redemption;
  }
}
