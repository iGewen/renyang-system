import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundOrder, RefundStatus, RefundType, Order, OrderStatus, Adoption, AdoptionStatus, PaymentRecord, AuditLog, User, RedemptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { NotificationService } from '../../notification/notification.service';
import { AlipayService } from '@/services/alipay.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { AdminService } from '../admin.service';
import { OrderStateService } from '@/modules/order/order-state.service';
import {
  OrderRefundRejectedEvent,
  OrderRefundCompletedEvent,
} from '@/common/events';

@Injectable()
export class AdminRefundService {
  private readonly logger = new Logger(AdminRefundService.name);

  constructor(
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
    private readonly alipayService: AlipayService,
    private readonly wechatPayService: WechatPayService,
    private readonly eventEmitter: EventEmitter2,
    private readonly orderStateService: OrderStateService,
  ) {}

  /**
   * 获取退款订单列表
   */
  async getRefundList(params: {
    page: number;
    pageSize: number;
    status?: number;
  }) {
    const queryBuilder = this.refundOrderRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user');

    if (params.status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status: params.status });
    }

    queryBuilder
      .orderBy('refund.createdAt', 'DESC')
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
   * 获取退款订单详情
   */
  async getRefundDetail(id: string) {
    const refund = await this.refundOrderRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款订单不存在');
    }

    return refund;
  }

  /**
   * 验证并获取退款订单
   */
  private async validateAndGetRefund(id: string): Promise<RefundOrder> {
    const refund = await this.refundOrderRepository.findOne({ where: { id } });
    if (!refund) {
      throw new NotFoundException('退款订单不存在');
    }
    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('该退款申请不在待审核状态');
    }
    return refund;
  }

  /**
   * 锁内验证退款状态
   */
  private async validateRefundLocked(manager: EntityManager, id: string): Promise<RefundOrder> {
    const refundLocked = await manager.findOne(RefundOrder, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!refundLocked || refundLocked.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('该退款申请已处理或不存在');
    }
    return refundLocked;
  }

  /**
   * 检查订单是否已退款（领养类型订单）
   */
  private async checkOrderAlreadyRefunded(manager: EntityManager, refund: RefundOrder): Promise<void> {
    if (refund.orderType !== 'adoption') return;

    const order = await manager.findOne(Order, {
      where: { id: refund.orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (order && order.status === OrderStatus.REFUNDED) {
      refund.status = RefundStatus.CANCELLED;
      refund.auditRemark = '订单已退款，自动取消重复退款申请';
      await manager.save(refund);
      throw new BadRequestException('该订单已完成退款，此申请已自动取消');
    }
  }

  /**
   * 检查是否有其他已完成的退款记录
   */
  private async checkDuplicateRefund(manager: EntityManager, refund: RefundOrder): Promise<void> {
    const completedRefund = await manager.findOne(RefundOrder, {
      where: {
        orderId: refund.orderId,
        orderType: refund.orderType,
        status: RefundStatus.REFUNDED,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (completedRefund) {
      refund.status = RefundStatus.CANCELLED;
      refund.auditRemark = '已有退款完成，自动取消重复退款申请';
      await manager.save(refund);
      throw new BadRequestException('该订单已有退款完成，此申请已自动取消');
    }
  }

  /**
   * 处理审核拒绝
   */
  private async handleRefundRejection(
    manager: EntityManager,
    refund: RefundOrder,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip: string | undefined,
    beforeData: { status: number },
  ): Promise<RefundOrder> {
    refund.status = RefundStatus.AUDIT_REJECTED;
    refund.auditAdminId = adminId;
    refund.auditAt = new Date();
    if (remark) {
      refund.auditRemark = remark;
    }
    await manager.save(refund);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'refund',
      action: 'reject',
      targetType: 'refund',
      targetId: refund.id,
      beforeData,
      afterData: { status: refund.status, remark },
      remark: '审核拒绝退款申请',
      ip,
    });

    this.eventEmitter.emit('order.refund.rejected', new OrderRefundRejectedEvent(
      refund.orderId,
      refund.id,
      adminId,
      adminName,
      remark,
    ));

    return refund;
  }

  /**
   * 尝试原路退款（微信/支付宝），返回退款方式和提示信息
   */
  private async processOriginalRefund(
    paymentRecord: PaymentRecord | null,
    refundAmount: number,
    reason: string,
    attempts: number = 1,
  ): Promise<{ refundMethod: string; refundMessage: string }> {
    if (!paymentRecord?.paymentMethod || !paymentRecord.paymentNo) {
      return { refundMethod: 'balance', refundMessage: '已退回到账户余额' };
    }

    const paymentMethod = paymentRecord.paymentMethod;
    const totalAmount = Number(paymentRecord.amount);

    if (paymentMethod === 'wechat') {
      return this.processWechatRefund(paymentRecord.paymentNo, totalAmount, refundAmount, reason, attempts);
    }

    if (paymentMethod === 'alipay') {
      return this.processAlipayRefund(paymentRecord.paymentNo, refundAmount, reason, attempts);
    }

    return { refundMethod: 'balance', refundMessage: '已退回到账户余额' };
  }

  /**
   * 微信原路退款
   */
  private async processWechatRefund(
    paymentNo: string,
    totalAmount: number,
    refundAmount: number,
    reason: string,
    attempts: number = 1,
  ): Promise<{ refundMethod: string; refundMessage: string }> {
    try {
      const result = await this.wechatPayService.refund(paymentNo, totalAmount, refundAmount, reason || '管理员审核退款');
      if (result.success) {
        return { refundMethod: 'wechat', refundMessage: '已退回到微信支付账户' };
      }
      return { refundMethod: 'balance', refundMessage: `微信退款失败(${result.message}): 尝试 ${attempts} 次后，已退回到账户余额` };
    } catch {
      return { refundMethod: 'balance', refundMessage: `微信退款异常: 尝试 ${attempts} 次后，已退回到账户余额` };
    }
  }

  /**
   * 支付宝原路退款
   */
  private async processAlipayRefund(
    paymentNo: string,
    refundAmount: number,
    reason: string,
    attempts: number = 1,
  ): Promise<{ refundMethod: string; refundMessage: string }> {
    try {
      const result = await this.alipayService.refund(paymentNo, refundAmount, reason || '管理员审核退款');
      if (result.success) {
        return { refundMethod: 'alipay', refundMessage: '已退回到支付宝账户' };
      }
      return { refundMethod: 'balance', refundMessage: `支付宝退款失败(${result.message}): 尝试 ${attempts} 次后，已退回到账户余额` };
    } catch {
      return { refundMethod: 'balance', refundMessage: `支付宝退款异常: 尝试 ${attempts} 次后，已退回到账户余额` };
    }
  }

  /**
   * 退款到用户余额
   */
  private async refundToBalance(manager: EntityManager, refund: RefundOrder): Promise<void> {
    if (refund.refundAmount <= 0) return;

    const user = await manager.findOne(User, {
      where: { id: refund.userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) return;

    const beforeBalance = Number(user.balance) || 0;
    const refundAmountNum = Number(refund.refundAmount);
    const afterBalance = Math.round((beforeBalance + refundAmountNum) * 100) / 100;
    user.balance = afterBalance;
    await manager.save(user);

    const balanceLog = manager.create('BalanceLog' as any, {
      id: IdUtil.generate('BL'),
      userId: refund.userId,
      type: 3,
      amount: refundAmountNum,
      balanceBefore: beforeBalance,
      balanceAfter: afterBalance,
      relatedType: 'refund',
      relatedId: refund.id,
      remark: `退款: ${refund.refundNo}`,
    });
    await manager.save(balanceLog);
  }

  /**
   * 带重试的原路退款（最多3次，间隔1s/2s/4s）
   */
  private async processRefundWithRetry(
    paymentRecord: PaymentRecord | null,
    refundAmount: number,
    reason: string,
  ): Promise<{ refundMethod: string; refundMessage: string }> {
    const MAX_RETRIES = 3;
    const delays = [1000, 2000, 4000];
    let lastResult: { refundMethod: string; refundMessage: string } = { refundMethod: 'balance', refundMessage: '已退回到账户余额' };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      lastResult = await this.processOriginalRefund(paymentRecord, refundAmount, reason, attempt);
      if (lastResult.refundMethod !== 'balance') {
        return lastResult;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, delays[attempt - 1]));
      }
    }

    return lastResult;
  }

  /**
   * 创建退款处理记录 + 启动异步退款（统一入口）
   */
  private async startRefundProcessing(
    manager: EntityManager,
    refund: RefundOrder,
    adminId: string,
    adminName: string,
    action: string,
    remarkPrefix: string,
    ip?: string,
    beforeData?: { status: number },
  ): Promise<RefundOrder> {
    refund.status = RefundStatus.REFUNDED;
    refund.refundMethod = 'processing';
    refund.operatorId = adminId;
    refund.refundAt = new Date();
    await manager.save(refund);

    if (beforeData) {
      await this.adminService.createAuditLog({
        adminId,
        adminName,
        module: 'refund',
        action,
        targetType: 'refund',
        targetId: refund.id,
        beforeData,
        afterData: { status: refund.status, remark: remarkPrefix },
        remark: `${remarkPrefix}，退款金额: ¥${refund.refundAmount}，异步处理中`,
        ip,
      });
    }

    return refund;
  }

  /**
   * 异步执行退款（原路→重试3次→兜底余额）
   */
  private async processRefundAsync(params: {
    refundId: string;
    refundAmount: number;
    orderType: string;
    orderId: string;
    userId: string;
    adminId: string;
  }): Promise<void> {
    const { refundId, refundAmount, orderType, orderId, userId, adminId } = params;
    await this.dataSource.transaction(async (manager) => {
      const refund = await manager.findOne(RefundOrder, {
        where: { id: refundId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!refund) return;

      const paymentRecord = orderId ? await manager.findOne(PaymentRecord, {
        where: { orderType, orderId },
        order: { createdAt: 'DESC' },
      }) : null;

      const refundReason = refund.reason || '管理员退款';
      const { refundMethod, refundMessage } = await this.processRefundWithRetry(paymentRecord, Number(refundAmount), refundReason);

      if (refundMethod === 'balance') {
        await this.refundToBalance(manager, refund);
      }

      refund.refundMethod = refundMethod;
      await manager.save(refund);

      if (orderType === 'adoption' && orderId) {
        await this.updateRelatedOrderStatus(manager, refund);
      }

      await this.logOrderStateTransition(orderId, refundMethod, adminId);

      await this.adminService.createAuditLog({
        adminId,
        adminName: 'admin',
        module: 'refund',
        action: 'refund_async_complete',
        targetType: orderType,
        targetId: orderId || refundId,
        afterData: { refundId, refundMethod, refundAmount },
        remark: `退款完成: ¥${refundAmount}, ${refundMessage}`,
        ip: undefined,
      });
    }).then(() => {
      this.eventEmitter.emit('order.refund.completed', new OrderRefundCompletedEvent(
        orderId,
        refundId,
        'completed',
        Number(refundAmount),
      ));
      this.notificationService.sendBalanceNotification(
        userId,
        '退款完成通知',
        `您的退款¥${refundAmount}已完成`,
      ).catch(err => this.logger.error('发送退款通知失败', err));
    }).catch(err => {
      this.logger.error(`异步退款处理失败: ${refundId}`, err);
    });
  }

  /**
   * 触发异步退款（setImmediate 脱离请求上下文）
   */
  private triggerRefundAsync(
    refund: RefundOrder,
    refundAmount: number,
    orderType: string,
    orderId: string,
    userId: string,
    adminId: string,
  ): void {
    setImmediate(() => this.processRefundAsync({
      refundId: refund.id,
      refundAmount,
      orderType,
      orderId,
      userId,
      adminId,
    }));
  }

  /**
   * 更新关联订单和领养状态
   */
  private async updateRelatedOrderStatus(manager: EntityManager, refund: RefundOrder): Promise<void> {
    if (refund.orderType !== 'adoption') return;

    const order = await manager.findOne(Order, { where: { id: refund.orderId } });
    if (!order || order.status === OrderStatus.REFUNDED) return;

    order.status = OrderStatus.REFUNDED;
    await manager.save(Order, order);

    const adoption = await manager.findOne(Adoption, { where: { orderId: order.id } });
    if (!adoption) return;

    adoption.status = AdoptionStatus.TERMINATED;
    await manager.save(Adoption, adoption);

    await manager.createQueryBuilder()
      .update('redemption_orders' as any)
      .set({ status: RedemptionStatus.CANCELLED })
      .where('adoption_id = :adoptionId AND status IN (1, 2)', { adoptionId: adoption.id })
      .execute();
  }

  /**
   * 记录订单状态变更历史
   */
  private async logOrderStateTransition(
    orderId: string,
    refundMethod: string,
    adminId: string,
  ): Promise<void> {
    try {
      await this.orderStateService.transition(
        orderId,
        OrderStatus.REFUNDED,
        { id: adminId, type: 'admin' },
        `退款审核通过，退款方式: ${refundMethod}`,
      );
    } catch (error) {
      this.logger.warn(`订单状态历史记录失败: ${orderId}`, error);
    }
  }

  /**
   * 审核退款申请（拒绝同步处理，批准走统一异步退款）
   */
  async auditRefund(
    id: string,
    approved: boolean,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    const refund = await this.validateAndGetRefund(id);

    const lockKey = `refund:lock:${refund.orderType}:${refund.orderId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      return this.dataSource.transaction(async (manager) => {
        const refundLocked = await this.validateRefundLocked(manager, id);

        await this.checkOrderAlreadyRefunded(manager, refundLocked);
        await this.checkDuplicateRefund(manager, refundLocked);

        const beforeData = { status: refundLocked.status };

        if (!approved) {
          return this.handleRefundRejection(manager, refundLocked, remark, adminId, adminName, ip, beforeData);
        }

        refundLocked.auditAdminId = adminId;
        refundLocked.auditAt = new Date();
        if (remark) {
          refundLocked.auditRemark = remark;
        }

        const result = await this.startRefundProcessing(
          manager,
          refundLocked,
          adminId,
          adminName,
          'approve',
          `审核通过退款申请`,
          ip,
          beforeData,
        );

        this.triggerRefundAsync(
          result,
          Number(refundLocked.refundAmount),
          refundLocked.orderType,
          refundLocked.orderId,
          refundLocked.userId,
          adminId,
        );

        return result;
      });
    });
  }

  /**
   * 管理员直接退款
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

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const resolvedOrderType = orderType || 'admin';
    const resolvedOrderId = orderId || '';

    const lockKey = resolvedOrderId
      ? `refund:lock:${resolvedOrderType}:${resolvedOrderId}`
      : `refund:lock:admin:${userId}:${Date.now()}`;

    return this.redisService.withLock(lockKey, 30000, async () => {
      const refund = await this.dataSource.transaction(async (manager) => {
        if (resolvedOrderId) {
          await this.checkOrderAlreadyRefunded(manager, { orderId: resolvedOrderId, orderType: resolvedOrderType } as RefundOrder);
          const duplicateRefund = await manager.findOne(RefundOrder, {
            where: {
              orderId: resolvedOrderId,
              orderType: resolvedOrderType,
              status: RefundStatus.REFUNDED,
            },
            lock: { mode: 'pessimistic_write' },
          });
          if (duplicateRefund) {
            throw new BadRequestException('该订单已有退款完成，不可重复退款');
          }
        }

        const refundEntity = manager.create(RefundOrder, {
          id: IdUtil.generate('RFD'),
          refundNo: IdUtil.generateRefundNo(),
          userId,
          orderType: resolvedOrderType,
          orderId: resolvedOrderId,
          originalAmount: amount,
          refundAmount: amount,
          refundLivestock: 2,
          reason,
          type: RefundType.ADMIN_OPERATE,
          status: RefundStatus.REFUNDED,
          auditAdminId: adminId,
          auditAt: new Date(),
          operatorId: adminId,
          refundMethod: 'processing',
          refundAt: new Date(),
        });
        await manager.save(refundEntity);

        await this.adminService.createAuditLog({
          adminId,
          adminName: adminName || 'admin',
          module: 'refund',
          action: 'refund',
          targetType: resolvedOrderType,
          targetId: resolvedOrderId || refundEntity.id,
          afterData: {
            refundNo: refundEntity.refundNo,
            userId,
            amount,
            reason,
            orderType: resolvedOrderType,
            orderId: resolvedOrderId,
          },
          remark: `管理员退款: ¥${amount}, 原因: ${reason}，异步处理中`,
          ip,
        });

        return refundEntity;
      });

      this.triggerRefundAsync(
        refund,
        amount,
        resolvedOrderType,
        resolvedOrderId,
        userId,
        adminId,
      );

      return refund;
    });
  }
}
