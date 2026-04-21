import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { RedemptionOrder, RedemptionType, RedemptionStatus, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { AdoptionService } from '../adoption/adoption.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { normalizePagination, buildPaginationResult } from '@/common/utils/pagination.util';

@Injectable()
export class RedemptionService {
  constructor(
    @InjectRepository(RedemptionOrder)
    private readonly redemptionRepository: Repository<RedemptionOrder>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly adoptionService: AdoptionService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 获取买断预览信息（不创建订单）
   */
  async getRedemptionPreview(adoptionId: string, userId: string) {
    // 获取领养信息
    const adoption = await this.adoptionRepository.findOne({
      where: { id: adoptionId, userId },
      relations: ['livestock'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    // 计算买断金额
    const livestock = adoption.livestockSnapshot;
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

    return {
      adoption,
      amount,
      type: type === RedemptionType.FULL ? 'full' : 'early',
      feedMonthsPaid: adoption.feedMonthsPaid,
      requiredMonths,
      remainingMonths,
      monthlyFeedFee,
    };
  }

  /**
   * 申请买断
   */
  async applyRedemption(adoptionId: string, userId: string) {
    // 使用事务确保数据一致性
    return this.dataSource.transaction(async (manager) => {
      // 获取领养信息
      const adoption = await manager.findOne(Adoption, {
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
      const existingRedemption = await manager.findOne(RedemptionOrder, {
        where: {
          adoptionId,
          status: RedemptionStatus.PENDING_AUDIT,
        },
      });

      if (existingRedemption) {
        throw new BadRequestException('已有待审核的买断申请');
      }

      // 安全修复 B-08：检查是否有未支付的饲料费账单（包括逾期状态）
      const unpaidBillsCount = await manager.count('FeedBill' as any, {
        where: { adoptionId, status: In([1, 3]) }, // 1=PENDING, 3=OVERDUE
      });

      if (unpaidBillsCount > 0) {
        throw new BadRequestException(`存在 ${unpaidBillsCount} 笔未支付的饲料费账单，请先完成支付后再申请买断`);
      }

      // 计算买断金额
      const livestock = adoption.livestockSnapshot;
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
      const redemption = manager.create(RedemptionOrder, {
        id: IdUtil.generate('RDM'),
        redemptionNo: IdUtil.generateRedemptionNo(),
        adoptionId,
        userId,
        livestockId: adoption.livestockId,
        type,
        originalAmount: amount,
        finalAmount: amount,
        status: RedemptionStatus.PENDING_AUDIT,
      });

      await manager.save(redemption);

      // 更新领养状态为买断审核中
      adoption.status = AdoptionStatus.REDEMPTION_PENDING;
      await manager.save(adoption);

      return {
        redemption,
        type: type === RedemptionType.FULL ? 'full' : 'early',
        remainingMonths,
        monthlyFeedFee,
      };
    });
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

    // 修复 B-BIZ-011：取消买断申请时，需要重新计算领养状态
    // 不能简单地恢复为 ACTIVE，应该根据 feedMonthsPaid 判断
    const adoption = redemption.adoption;
    const requiredMonths = adoption.redemptionMonths - 1; // 首月免费
    if (adoption.feedMonthsPaid >= requiredMonths) {
      // 已达到买断条件，恢复为可买断状态
      adoption.status = AdoptionStatus.REDEEMABLE;
    } else {
      // 未达到买断条件，恢复为正常领养状态
      adoption.status = AdoptionStatus.ACTIVE;
    }
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
      relations: ['adoption', 'livestock'],
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
        // 安全修复 B-BIZ-023：验证调整金额不能为负数
        if (adjustedAmount !== undefined && adjustedAmount !== null) {
          if (adjustedAmount < 0) {
            throw new BadRequestException('调整金额不能为负数');
          }
          // 验证调整金额不能超过原金额太多（防止异常数据）
          if (adjustedAmount > redemption.originalAmount * 2) {
            throw new BadRequestException('调整金额异常，请检查后重试');
          }
        }

        // 审核通过
        redemption.status = RedemptionStatus.AUDIT_PASSED;
        redemption.auditAdminId = adminId;
        redemption.auditAt = new Date();
        redemption.auditRemark = remark || '';
        // 设置24小时过期时间
        redemption.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // 如果有调整金额
        if (adjustedAmount !== undefined && adjustedAmount !== null) {
          redemption.adjustedAmount = adjustedAmount;
          redemption.finalAmount = adjustedAmount;
          redemption.adjustReason = remark || '';
        }

        await this.redemptionRepository.save(redemption);

        // 发送审核通过通知
        const livestock = redemption.livestock;
        await this.notificationService.sendRedemptionAuditResult({
          userId: redemption.userId,
          redemptionId: redemption.id,
          redemptionNo: redemption.redemptionNo,
          livestockName: livestock?.name || '活体',
          approved: true,
          amount: Number(redemption.finalAmount),
          remark: remark,
        });
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

        // 发送审核拒绝通知
        const livestock = redemption.livestock;
        await this.notificationService.sendRedemptionAuditResult({
          userId: redemption.userId,
          redemptionId: redemption.id,
          redemptionNo: redemption.redemptionNo,
          livestockName: livestock?.name || '活体',
          approved: false,
          remark: remark,
        });
      }

      return redemption;
    });
  }

  /**
   * 支付买断
   */
  async payRedemption(redemptionId: string, userId: string, paymentMethod: string) {
    // 修复 B-BIZ-005：加载 adoption 关联，防止 completeRedemption 访问 undefined
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId, userId },
      relations: ['adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断记录不存在');
    }

    if (redemption.status !== RedemptionStatus.AUDIT_PASSED) {
      throw new BadRequestException('买断订单未通过审核或已支付');
    }

    // 检查是否已过期
    if (redemption.expireAt && new Date() > redemption.expireAt) {
      // 自动取消过期订单
      await this.cancelExpiredRedemption(redemption);
      throw new BadRequestException('买断订单已过期，请重新申请');
    }

    // 确保 finalAmount 是数字类型
    const finalAmount = Number(redemption.finalAmount) || 0;

    // 满期买断不需要支付
    if (finalAmount <= 0) {
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
      finalAmount,
      paymentMethod,
    );

    // 如果是余额支付，支付已完成
    if (paymentMethod === 'balance') {
      return { success: true, amount: finalAmount };
    }

    return {
      success: false,
      amount: finalAmount,
      payUrl: payment.payUrl,
      paymentNo: payment.paymentNo,
      redemptionNo: redemption.redemptionNo,
    };
  }

  /**
   * 支付成功后处理
   */
  async handlePaymentSuccess(redemptionId: string, paymentNo: string, paymentMethod: string) {
    // 使用分布式锁确保幂等性
    const lockKey = `redemption:payment:${redemptionId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      // 使用事务确保原子性
      return this.dataSource.transaction(async (manager) => {
        const redemption = await manager.findOne(RedemptionOrder, {
          where: { id: redemptionId },
          relations: ['adoption'],
        });

        if (!redemption) {
          throw new NotFoundException('买断记录不存在');
        }

        // 幂等检查：如果已支付，直接返回
        if (redemption.status === RedemptionStatus.PAID) {
          return redemption;
        }

        // 检查状态是否允许支付
        if (redemption.status !== RedemptionStatus.AUDIT_PASSED) {
          throw new BadRequestException('买断订单状态不允许支付');
        }

        redemption.status = RedemptionStatus.PAID;
        redemption.paymentMethod = paymentMethod;
        redemption.paymentNo = paymentNo;
        redemption.paidAmount = redemption.finalAmount;
        redemption.paidAt = new Date();

        await manager.save(redemption);

        // 更新领养状态
        const adoption = redemption.adoption;
        adoption.status = AdoptionStatus.REDEEMED;
        await manager.save(adoption);

        return redemption;
      });
    });
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
  async getPendingRedemptions(page?: number, pageSize?: number) {
    const { page: normalizedPage, pageSize: normalizedPageSize, skip } = normalizePagination(page, pageSize);

    const queryBuilder = this.redemptionRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.adoption', 'adoption')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.user', 'user')
      .where('redemption.status = :status', { status: RedemptionStatus.PENDING_AUDIT })
      .orderBy('redemption.createdAt', 'ASC')
      .skip(skip)
      .take(normalizedPageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return buildPaginationResult(list, total, normalizedPage, normalizedPageSize);
  }

  /**
   * 获取所有买断列表（管理员）
   */
  async getAllRedemptions(page?: number, pageSize?: number, status?: RedemptionStatus) {
    const { page: normalizedPage, pageSize: normalizedPageSize, skip } = normalizePagination(page, pageSize);

    const queryBuilder = this.redemptionRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.adoption', 'adoption')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.user', 'user');

    if (status !== undefined) {
      queryBuilder.andWhere('redemption.status = :status', { status });
    }

    queryBuilder
      .orderBy('redemption.createdAt', 'DESC')
      .skip(skip)
      .take(normalizedPageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return buildPaginationResult(list, total, normalizedPage, normalizedPageSize);
  }

  /**
   * 取消过期的买断订单
   * 安全修复：使用分布式锁确保并发安全
   */
  private async cancelExpiredRedemption(redemption: RedemptionOrder) {
    // 安全修复：使用分布式锁防止并发处理同一订单
    const lockKey = `redemption:cancel:${redemption.id}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      // 重新查询确认状态未变
      const freshRedemption = await this.redemptionRepository.findOne({
        where: { id: redemption.id },
      });

      if (!freshRedemption || freshRedemption.status !== RedemptionStatus.AUDIT_PASSED) {
        return; // 已被处理或状态已变
      }

      // 更新买断状态为已取消
      freshRedemption.status = RedemptionStatus.CANCELLED;
      await this.redemptionRepository.save(freshRedemption);

      // 恢复领养状态为原来的领养中状态
      const adoption = await this.adoptionRepository.findOne({
        where: { id: freshRedemption.adoptionId },
      });
      if (adoption) {
        adoption.status = AdoptionStatus.ACTIVE;
        await this.adoptionRepository.save(adoption);
      }

      // 发送超时取消通知
      const livestock = freshRedemption.livestock;
      await this.notificationService.sendRedemptionNotification(
        freshRedemption.userId,
        '买断订单已过期取消',
        `您的买断申请（${livestock?.name || '活体'}）因超过24小时未支付已自动取消，领养状态已恢复。如需买断请重新申请。`,
        freshRedemption.id,
      );
    });
  }

  /**
   * 定时任务：取消所有过期的买断订单
   * 安全修复：使用分布式锁确保多实例部署时不会重复处理
   */
  async cancelExpiredRedemptions() {
    // 安全修复：全局锁，确保同一时间只有一个实例在处理过期订单
    const globalLockKey = 'redemption:cancel:global';
    return this.redisService.withLock(globalLockKey, 60000, async () => {
      const now = new Date();

      // 查找所有已过期且状态为审核通过的买断订单
      const expiredRedemptions = await this.redemptionRepository
        .createQueryBuilder('redemption')
        .leftJoinAndSelect('redemption.livestock', 'livestock')
        .where('redemption.status = :status', { status: RedemptionStatus.AUDIT_PASSED })
        .andWhere('redemption.expireAt IS NOT NULL')
        .andWhere('redemption.expireAt < :now', { now })
        .getMany();

      if (!expiredRedemptions || expiredRedemptions.length === 0) {
        return;
      }

      for (const redemption of expiredRedemptions) {
        try {
          await this.cancelExpiredRedemption(redemption);
        } catch (error) {
          console.error(`取消过期买断订单失败: ${redemption.id}`, error);
        }
      }
    });
  }
}
