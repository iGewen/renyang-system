import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { RefundOrder, RefundType, RefundStatus, Order, OrderStatus, Adoption, AdoptionStatus, PaymentRecord, AuditLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { AlipayService } from '@/services/alipay.service';
import { normalizePagination, buildPaginationResult } from '@/common/utils/pagination.util';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(RefundOrder)
    private readonly refundRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly wechatPayService: WechatPayService,
    private readonly alipayService: AlipayService,
  ) {}

  /**
   * 用户申请退款
   */
  async applyRefund(
    userId: string,
    orderType: string,
    orderId: string,
    reason: string,
  ) {
    // 使用分布式锁防止重复申请
    const lockKey = `refund:apply:${orderType}:${orderId}`;
    return this.redisService.withLock(lockKey, 10000, async () => {
      // 使用事务确保原子性
      return this.dataSource.transaction(async (manager) => {
        // 验证订单
        let order: Order | null = null;
        let adoption: Adoption | null = null;
        let originalAmount = 0;

        if (orderType === 'adoption') {
          order = await manager.findOne(Order, {
            where: { id: orderId, userId },
          });

          if (!order) {
            throw new NotFoundException('订单不存在');
          }

          if (order.status !== OrderStatus.PAID) {
            throw new BadRequestException('订单状态不允许退款');
          }

          originalAmount = Number(order.totalAmount);

          // 查找领养记录
          adoption = await manager.findOne(Adoption, {
            where: { orderId: order.id },
          });

          if (adoption && adoption.status !== AdoptionStatus.ACTIVE) {
            throw new BadRequestException('领养状态不允许退款');
          }

          // 领养订单需要退活体
        } else if (orderType === 'feed') {
          // 饲料费退款逻辑
          throw new BadRequestException('饲料费退款请联系客服处理');
        } else if (orderType === 'redemption') {
          throw new BadRequestException('买断订单不支持退款');
        } else {
          throw new BadRequestException('不支持的订单类型');
        }

        // 领养订单标记需要退活体
        const refundLivestock = orderType === 'adoption' ? 1 : 0;

        // 安全修复 B-BIZ-012：检查所有非终态的退款申请，防止重复退款
        const existingRefund = await manager.findOne(RefundOrder, {
          where: {
            orderType,
            orderId,
            status: In([RefundStatus.PENDING_AUDIT, RefundStatus.AUDIT_PASSED]),
          },
        });

        if (existingRefund) {
          if (existingRefund.status === RefundStatus.PENDING_AUDIT) {
            throw new BadRequestException('已有待审核的退款申请');
          } else {
            throw new BadRequestException('该订单已审核通过待退款，请勿重复申请');
          }
        }

        // 创建退款订单
        const refund = manager.create(RefundOrder, {
          id: IdUtil.generate('RFD'),
          refundNo: IdUtil.generateRefundNo(),
          userId,
          orderType,
          orderId,
          originalAmount,
          refundAmount: originalAmount, // 默认全额退款
          refundLivestock,
          reason,
          type: RefundType.USER_APPLY,
          status: RefundStatus.PENDING_AUDIT,
        });

        await manager.save(refund);

        return refund;
      });
    });
  }

  /**
   * 获取退款详情
   */
  async getRefundDetail(refundId: string, userId?: string) {
    const where: any = { id: refundId };
    if (userId) {
      where.userId = userId;
    }

    const refund = await this.refundRepository.findOne({
      where,
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    return refund;
  }

  /**
   * 获取用户的退款列表
   */
  async getMyRefunds(userId: string, status?: RefundStatus) {
    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .where('refund.userId = :userId', { userId });

    if (status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status });
    }

    queryBuilder.orderBy('refund.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * 取消退款申请
   */
  async cancelRefund(refundId: string, userId: string) {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId, userId },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许取消');
    }

    refund.status = RefundStatus.CANCELLED;
    await this.refundRepository.save(refund);

    return { success: true };
  }

  /**
   * 审核退款申请（管理员）
   * 需要二次确认
   */
  async auditRefund(
    refundId: string,
    adminId: string,
    passed: boolean,
    refundAmount: number,
    remark: string,
    confirmToken?: string,
  ) {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId },
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许审核');
    }

    // 第一次审核，生成确认token
    if (!confirmToken) {
      const token = `refund:confirm:${refundId}:${Date.now()}`;
      await this.redisService.set(token, adminId, 300); // 5分钟有效

      return {
        needConfirm: true,
        confirmToken: token,
        message: '请再次确认退款操作',
      };
    }

    // 验证确认token
    const storedAdminId = await this.redisService.get(confirmToken);
    if (!storedAdminId || storedAdminId !== adminId) {
      throw new BadRequestException('确认token无效或已过期');
    }

    const lockKey = `refund:audit:${refundId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (passed) {
        // 安全修复：校验退款金额不能超过原订单金额
        if (refundAmount > refund.originalAmount) {
          throw new BadRequestException('退款金额不能超过原订单金额');
        }
        if (refundAmount <= 0) {
          throw new BadRequestException('退款金额必须大于0');
        }

        // 审核通过
        refund.status = RefundStatus.AUDIT_PASSED;
        refund.auditAdminId = adminId;
        refund.auditAt = new Date();
        refund.auditRemark = remark;
        refund.refundAmount = refundAmount;

        await this.refundRepository.save(refund);

        // 执行退款
        await this.executeRefund(refund, adminId);
      } else {
        // 审核拒绝
        refund.status = RefundStatus.AUDIT_REJECTED;
        refund.auditAdminId = adminId;
        refund.auditAt = new Date();
        refund.auditRemark = remark;

        await this.refundRepository.save(refund);
      }

      // 删除确认token
      await this.redisService.del(confirmToken);

      return refund;
    });
  }

  /**
   * 执行退款 - 原路退回
   * 安全修复：将外部API调用移到事务外执行
   * 根据支付方式选择退款渠道：
   * - 微信支付 → 退回到微信
   * - 支付宝支付 → 退回到支付宝
   * - 余额支付 → 退回到余额
   */
  private async executeRefund(refund: RefundOrder, operatorId: string) {
    // 获取原支付记录
    const paymentRecord = await this.paymentRecordRepository.findOne({
      where: {
        orderType: refund.orderType,
        orderId: refund.orderId,
      },
      order: { createdAt: 'DESC' },
    });

    let refundMethod = 'balance';
    let refundMessage = '';

    // 安全修复：先执行外部API退款（在事务外）
    if (paymentRecord?.paymentMethod && paymentRecord.paymentNo) {
      const paymentMethod = paymentRecord.paymentMethod;
      const totalAmount = Number(paymentRecord.amount);
      const refundAmount = Number(refund.refundAmount);

      if (paymentMethod === 'wechat') {
        // 微信支付退款
        this.logger.log(`[Refund] 微信支付退款 - 订单号: ${paymentRecord.paymentNo}, 金额: ${refundAmount}`);
        try {
          const result = await this.wechatPayService.refund(
            paymentRecord.paymentNo,
            totalAmount,
            refundAmount,
            refund.reason || '用户申请退款',
          );
          if (result.success) {
            refundMethod = 'wechat';
            refundMessage = '已退回到微信支付账户';
            this.logger.log(`[Refund] 微信退款成功 - 退款单号: ${result.refundId}`);
          } else {
            // 微信退款失败，退回到余额
            this.logger.error(`[Refund] 微信退款失败: ${result.message}, 改为退回到余额`);
            refundMessage = `微信退款失败(${result.message})，已退回到账户余额`;
          }
        } catch (error) {
          this.logger.error(`[Refund] 微信退款异常: ${error.message}, 改为退回到余额`);
          refundMessage = `微信退款异常，已退回到账户余额`;
        }
      } else if (paymentMethod === 'alipay') {
        // 支付宝退款
        this.logger.log(`[Refund] 支付宝退款 - 订单号: ${paymentRecord.paymentNo}, 金额: ${refundAmount}`);
        try {
          const result = await this.alipayService.refund(
            paymentRecord.paymentNo,
            refundAmount,
            refund.reason || '用户申请退款',
          );
          if (result.success) {
            refundMethod = 'alipay';
            refundMessage = '已退回到支付宝账户';
            this.logger.log(`[Refund] 支付宝退款成功 - 退款单号: ${result.refundNo}`);
          } else {
            // 支付宝退款失败，退回到余额
            this.logger.error(`[Refund] 支付宝退款失败: ${result.message}, 改为退回到余额`);
            refundMessage = `支付宝退款失败(${result.message})，已退回到账户余额`;
          }
        } catch (error) {
          this.logger.error(`[Refund] 支付宝退款异常: ${error.message}, 改为退回到余额`);
          refundMessage = `支付宝退款异常，已退回到账户余额`;
        }
      } else if (paymentMethod === 'balance') {
        // 余额支付，直接退回到余额
        refundMethod = 'balance';
        refundMessage = '已退回到账户余额';
      }
    }

    // 安全修复：使用事务处理数据库操作（不包含外部API调用）
    await this.dataSource.transaction(async (manager) => {
      // 如果原路退款失败或余额支付，退回到用户余额
      if (refundMethod === 'balance' && refund.refundAmount > 0) {
        // 安全修复：使用悲观锁避免竞态条件
        const user = await manager.findOne('User' as any, {
          where: { id: refund.userId },
          lock: { mode: 'pessimistic_write' },
        }) as any;

        if (user) {
          const beforeBalance = Number(user.balance) || 0;
          const refundAmountNum = Number(refund.refundAmount);
          const afterBalance = Math.round((beforeBalance + refundAmountNum) * 100) / 100;

          user.balance = afterBalance;
          await manager.save(user);

          // 记录余额变动日志
          const balanceLog = manager.create('BalanceLog' as any, {
            id: IdUtil.generate('BL'),
            userId: refund.userId,
            type: 3, // 退款
            amount: refundAmountNum,
            balanceBefore: beforeBalance,
            balanceAfter: afterBalance,
            relatedType: 'refund',
            relatedId: refund.id,
            remark: `退款: ${refund.refundNo}`,
          });
          await manager.save(balanceLog);
        }
      }

      // 更新退款状态
      refund.status = RefundStatus.REFUNDED;
      refund.refundMethod = refundMethod;
      refund.operatorId = operatorId;
      refund.refundAt = new Date();

      await manager.save(RefundOrder, refund);

      // 更新原订单状态
      if (refund.orderType === 'adoption') {
        const order = await manager.findOne(Order, {
          where: { id: refund.orderId },
        });

        if (order) {
          order.status = OrderStatus.REFUNDED;
          await manager.save(Order, order);

          // 更新领养状态
          const adoption = await manager.findOne(Adoption, {
            where: { orderId: order.id },
          });

          if (adoption) {
            adoption.status = AdoptionStatus.TERMINATED;
            await manager.save(Adoption, adoption);
          }
        }
      }
    });

    // 发送通知（在事务外执行，不影响事务）
    this.notificationService.sendBalanceNotification(
      refund.userId,
      '退款成功',
      `您的退款申请已处理完成，退款金额¥${refund.refundAmount}${refundMessage}。`,
    ).catch(err => this.logger.error('发送退款通知失败:', err));
  }

  /**
   * 管理员直接退款
   * 安全修复：所有数据库操作移入事务内确保原子性
   */
  async adminRefund(params: {
    adminId: string;
    userId: string;
    amount: number;
    reason: string;
    orderType?: string;
    orderId?: string;
    adminName?: string;
    ip?: string;
  }) {
    const { adminId, userId, amount, reason, orderType, orderId, adminName, ip } = params;
    // 使用事务确保所有数据库操作的原子性
    const refund = await this.dataSource.transaction(async (manager) => {
      const refundEntity = manager.create(RefundOrder, {
        id: IdUtil.generate('RFD'),
        refundNo: IdUtil.generateRefundNo(),
        userId,
        orderType: orderType || 'admin',
        orderId: orderId || '',
        originalAmount: amount,
        refundAmount: amount,
        refundLivestock: 2, // 管理员操作不涉及活体
        reason,
        type: RefundType.ADMIN_OPERATE,
        status: RefundStatus.REFUNDED,
        auditAdminId: adminId,
        auditAt: new Date(),
        operatorId: adminId,
        refundMethod: 'balance',
        refundAt: new Date(),
      });

      await manager.save(refundEntity);

      // 退款到用户余额（在事务内）
      const user = await manager.findOne('User' as any, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      }) as any;
      if (user) {
        const beforeBalance = Number(user.balance) || 0;
        const afterBalance = Math.round((beforeBalance + amount) * 100) / 100;
        user.balance = afterBalance;
        await manager.save(user);

        // 记录余额变动日志
        const balanceLog = manager.create('BalanceLog' as any, {
          id: IdUtil.generate('BL'),
          userId,
          type: 3, // 退款
          amount,
          balanceBefore: beforeBalance,
          balanceAfter: afterBalance,
          relatedType: 'admin_refund',
          relatedId: refundEntity.id,
          remark: `管理员退款: ${refundEntity.refundNo}`,
        });
        await manager.save(balanceLog);
      }

      // 更新订单状态（在事务内）
      if (orderType === 'adoption' && orderId) {
        const order = await manager.findOne(Order, {
          where: { id: orderId },
        });

        if (order) {
          order.status = OrderStatus.REFUNDED;
          await manager.save(Order, order);

          // 更新领养状态
          const adoption = await manager.findOne(Adoption, {
            where: { orderId: order.id },
          });

          if (adoption) {
            adoption.status = AdoptionStatus.TERMINATED;
            await manager.save(Adoption, adoption);
          }
        }
      }

      // 记录审计日志（在事务内）
      const auditLog = manager.create(AuditLog, {
        adminId,
        adminName: adminName || 'admin',
        module: 'refund',
        action: 'refund',
        targetType: orderType || 'admin',
        targetId: orderId || refundEntity.id,
        afterData: {
          refundNo: refundEntity.refundNo,
          userId,
          amount,
          reason,
          orderType,
          orderId,
        },
        remark: `管理员退款: ¥${amount}, 原因: ${reason}`,
        ip,
      });
      await manager.save(auditLog);

      return refundEntity;
    });

    // 发送通知（在事务外执行，不影响事务）
    this.notificationService.sendBalanceNotification(
      userId,
      '退款通知',
      `您已收到一笔退款¥${amount}，原因：${reason}`,
    ).catch(err => this.logger.error('发送退款通知失败:', err));

    return refund;
  }

  /**
   * 获取待审核退款列表（管理员）
   */
  async getPendingRefunds(page?: number, pageSize?: number) {
    const { page: normalizedPage, pageSize: normalizedPageSize, skip } = normalizePagination(page, pageSize);

    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user')
      .where('refund.status = :status', { status: RefundStatus.PENDING_AUDIT })
      .orderBy('refund.createdAt', 'ASC')
      .skip(skip)
      .take(normalizedPageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return buildPaginationResult(list, total, normalizedPage, normalizedPageSize);
  }

  /**
   * 获取所有退款列表（管理员）
   */
  async getAllRefunds(page?: number, pageSize?: number, status?: RefundStatus) {
    const { page: normalizedPage, pageSize: normalizedPageSize, skip } = normalizePagination(page, pageSize);

    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user');

    if (status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status });
    }

    queryBuilder
      .orderBy('refund.createdAt', 'DESC')
      .skip(skip)
      .take(normalizedPageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return buildPaginationResult(list, total, normalizedPage, normalizedPageSize);
  }
}
