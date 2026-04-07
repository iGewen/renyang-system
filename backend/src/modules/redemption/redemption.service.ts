import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RedemptionOrder, RedemptionType, RedemptionStatus, Adoption, AdoptionStatus, PaymentRecord, PaymentStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { AdoptionService } from '../adoption/adoption.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class RedemptionService {
  constructor(
    @InjectRepository(RedemptionOrder)
    private redemptionRepository: Repository<RedemptionOrder>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    private dataSource: DataSource,
    private redisService: RedisService,
    private adoptionService: AdoptionService,
    private paymentService: PaymentService,
  ) {}

  /**
   * 申请买断
   */
  async applyRedemption(adoptionId: string, userId: string) {
    // 获取领养信息
    const adoption = await this.adoptionRepository.findOne({
      where: { id: adoptionId, userId },
      relations: ['livestock'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    // 检查状态
    if (adoption.status !== AdoptionStatus.ACTIVE &&
        adoption.status !== AdoptionStatus.REDEEMABLE &&
        adoption.status !== AdoptionStatus.FEED_OVERDUE) {
      throw new BadRequestException('当前状态不允许申请买断');
    }

    // 检查是否已有待审核的买断申请
    const existingRedemption = await this.redemptionRepository.findOne({
      where: {
        adoptionId,
        status: RedemptionStatus.PENDING_AUDIT,
      },
    });

    if (existingRedemption) {
      throw new BadRequestException('已有待审核的买断申请');
    }

    // 计算买断金额
    const livestock = adoption.livestockSnapshot as any;
    const requiredMonths = adoption.redemptionMonths - 1; // 首月免费
    const remainingMonths = Math.max(0, requiredMonths - adoption.feedMonthsPaid);
    const monthlyFeedFee = livestock?.monthlyFeedFee || 0;

    // 判断买断类型和金额
    let type: RedemptionType;
    let amount: number;

    if (remainingMonths === 0) {
      // 满期买断，不需要额外支付
      type = RedemptionType.FULL;
      amount = 0;
    } else {
      // 提前买断，需要支付剩余饲料费
      type = RedemptionType.EARLY;
      amount = remainingMonths * monthlyFeedFee;
    }

    // 创建买断订单
    const redemption = this.redemptionRepository.create({
      id: IdUtil.generate('RDM'),
      redemptionNo: IdUtil.generateRedemptionNo(),
      adoptionId,
      userId,
      livestockId: adoption.livestockId,
      type,
      originalAmount: amount,
      finalAmount: amount,
      status: RedemptionStatus.PENDING_AUDIT,
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时过期
    });

    await this.redemptionRepository.save(redemption);

    // 更新领养状态为买断审核中
    adoption.status = AdoptionStatus.REDEMPTION_PENDING;
    await this.adoptionRepository.save(adoption);

    return {
      redemption,
      type: type === RedemptionType.FULL ? 'full' : 'early',
      remainingMonths,
      monthlyFeedFee,
    };
  }

  /**
   * 获取买断详情
   */
  async getRedemptionDetail(redemptionId: string, userId?: string) {
    const where: any = { id: redemptionId };
    if (userId) {
      where.userId = userId;
    }

    const redemption = await this.redemptionRepository.findOne({
      where,
      relations: ['adoption', 'adoption.livestock'],
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    return redemption;
  }

  /**
   * 获取用户的买断列表
   */
  async getMyRedemptions(userId: string, status?: RedemptionStatus) {
    const queryBuilder = this.redemptionRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.adoption', 'adoption')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .where('redemption.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('redemption.status = :status', { status });
    }

    queryBuilder.orderBy('redemption.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * 取消买断申请
   */
  async cancelRedemption(redemptionId: string, userId: string) {
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId, userId },
      relations: ['adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    if (redemption.status !== RedemptionStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许取消');
    }

    // 更新买断状态
    redemption.status = RedemptionStatus.CANCELLED;
    await this.redemptionRepository.save(redemption);

    // 恢复领养状态
    const adoption = redemption.adoption;
    adoption.status = AdoptionStatus.ACTIVE;
    await this.adoptionRepository.save(adoption);

    return { success: true };
  }

  /**
   * 审核买断申请（管理员）
   */
  async auditRedemption(
    redemptionId: string,
    adminId: string,
    passed: boolean,
    adjustedAmount?: number,
    remark?: string,
  ) {
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId },
      relations: ['adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    if (redemption.status !== RedemptionStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许审核');
    }

    const lockKey = `redemption:audit:${redemptionId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (passed) {
        // 审核通过
        redemption.status = RedemptionStatus.AUDIT_PASSED;
        redemption.auditAdminId = adminId;
        redemption.auditAt = new Date();
        redemption.auditRemark = remark || '';

        // 如果有调整金额
        if (adjustedAmount !== undefined && adjustedAmount !== null) {
          redemption.adjustedAmount = adjustedAmount;
          redemption.finalAmount = adjustedAmount;
          redemption.adjustReason = remark || '';
        }

        // 更新过期时间
        redemption.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await this.redemptionRepository.save(redemption);
      } else {
        // 审核拒绝
        redemption.status = RedemptionStatus.AUDIT_REJECTED;
        redemption.auditAdminId = adminId;
        redemption.auditAt = new Date();
        redemption.auditRemark = remark || '';

        await this.redemptionRepository.save(redemption);

        // 恢复领养状态
        const adoption = redemption.adoption;
        adoption.status = AdoptionStatus.ACTIVE;
        await this.adoptionRepository.save(adoption);
      }

      return redemption;
    });
  }

  /**
   * 支付买断
   */
  async payRedemption(redemptionId: string, userId: string, paymentMethod: string) {
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId, userId },
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    if (redemption.status !== RedemptionStatus.AUDIT_PASSED) {
      throw new BadRequestException('买断订单未通过审核或已支付');
    }

    // 检查是否过期
    if (redemption.expireAt && new Date() > redemption.expireAt) {
      throw new BadRequestException('买断订单已过期');
    }

    // 满期买断不需要支付
    if (redemption.finalAmount <= 0) {
      redemption.status = RedemptionStatus.PAID;
      redemption.paidAmount = 0;
      redemption.paidAt = new Date();
      await this.redemptionRepository.save(redemption);

      // 更新领养状态
      await this.completeRedemption(redemption);

      return { success: true, amount: 0 };
    }

    // 创建支付
    const payment = await this.paymentService.createPayment(
      userId,
      'redemption',
      redemptionId,
      redemption.finalAmount,
      paymentMethod,
    );

    // 如果是余额支付，支付已完成
    if (paymentMethod === 'balance') {
      return { success: true, amount: redemption.finalAmount };
    }

    return {
      success: false,
      amount: redemption.finalAmount,
      payUrl: payment.payUrl,
      paymentNo: payment.paymentNo,
      redemptionNo: redemption.redemptionNo,
    };
  }

  /**
   * 支付成功后处理
   */
  async handlePaymentSuccess(redemptionId: string, paymentNo: string, paymentMethod: string) {
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId },
      relations: ['adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    redemption.status = RedemptionStatus.PAID;
    redemption.paymentMethod = paymentMethod;
    redemption.paymentNo = paymentNo;
    redemption.paidAmount = redemption.finalAmount;
    redemption.paidAt = new Date();

    await this.redemptionRepository.save(redemption);

    // 更新领养状态
    await this.completeRedemption(redemption);
  }

  /**
   * 完成买断
   */
  private async completeRedemption(redemption: RedemptionOrder) {
    const adoption = redemption.adoption;
    adoption.status = AdoptionStatus.REDEEMED;
    await this.adoptionRepository.save(adoption);
  }

  /**
   * 获取待审核的买断列表（管理员）
   */
  async getPendingRedemptions(page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.redemptionRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.adoption', 'adoption')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.user', 'user')
      .where('redemption.status = :status', { status: RedemptionStatus.PENDING_AUDIT })
      .orderBy('redemption.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
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
   * 获取所有买断列表（管理员）
   */
  async getAllRedemptions(page: number = 1, pageSize: number = 10, status?: RedemptionStatus) {
    const queryBuilder = this.redemptionRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.adoption', 'adoption')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.user', 'user');

    if (status !== undefined) {
      queryBuilder.andWhere('redemption.status = :status', { status });
    }

    queryBuilder
      .orderBy('redemption.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
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
}
