import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundOrder, RefundStatus, RefundType, Order, OrderStatus, Adoption, AdoptionStatus, PaymentRecord, AuditLog, User } from '@/entities';
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
   * 审核退款申请
   * 使用与申请阶段同一把分布式锁，确保互斥
   */
  async auditRefund(
    id: string,
    approved: boolean,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    const refund = await this.refundOrderRepository.findOne({ where: { id } });
    if (!refund) {
      throw new NotFoundException('退款订单不存在');
    }

    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('该退款申请不在待审核状态');
    }

    // 统一锁key，与申请阶段共用，确保申请和审核互斥
    const lockKey = `refund:lock:${refund.orderType}:${refund.orderId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      return this.dataSource.transaction(async (manager) => {
        // 检查1：退款申请状态（锁内再次确认）
        const refundLocked = await manager.findOne(RefundOrder, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!refundLocked || refundLocked.status !== RefundStatus.PENDING_AUDIT) {
          throw new BadRequestException('该退款申请已处理或不存在');
        }

        // 检查2：订单是否已退款
        if (refund.orderType === 'adoption') {
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

        // 检查3：是否有其他已完成的退款记录
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

        const beforeData = { status: refund.status };

        if (!approved) {
          // 审核拒绝
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
            targetId: id,
            beforeData,
            afterData: { status: refund.status, remark },
            remark: '审核拒绝退款申请',
            ip,
          });

          // 发出退款拒绝事件
          this.eventEmitter.emit('order.refund.rejected', new OrderRefundRejectedEvent(
            refund.orderId,
            refund.id,
            adminId,
            adminName,
            remark,
          ));

          return refund;
        }

        // 审核通过 - 执行退款
        refund.auditAdminId = adminId;
        refund.auditAt = new Date();
        if (remark) {
          refund.auditRemark = remark;
        }

        // 查找原支付记录
        const paymentRecord = await manager.findOne(PaymentRecord, {
          where: { orderType: refund.orderType, orderId: refund.orderId },
          order: { createdAt: 'DESC' },
        });

        let refundMethod = 'balance';
        let refundMessage = '已退回到账户余额';

        // 尝试原路退款
        if (paymentRecord?.paymentMethod && paymentRecord.paymentNo) {
          const paymentMethod = paymentRecord.paymentMethod;
          const totalAmount = Number(paymentRecord.amount);
          const refundAmount = Number(refund.refundAmount);

          if (paymentMethod === 'wechat') {
            try {
              const result = await this.wechatPayService.refund(
                paymentRecord.paymentNo,
                totalAmount,
                refundAmount,
                refund.reason || '管理员审核退款',
              );
              if (result.success) {
                refundMethod = 'wechat';
                refundMessage = '已退回到微信支付账户';
              } else {
                refundMessage = `微信退款失败(${result.message})，已退回到账户余额`;
              }
            } catch {
              refundMessage = '微信退款异常，已退回到账户余额';
            }
          } else if (paymentMethod === 'alipay') {
            try {
              const result = await this.alipayService.refund(
                paymentRecord.paymentNo,
                refundAmount,
                refund.reason || '管理员审核退款',
              );
              if (result.success) {
                refundMethod = 'alipay';
                refundMessage = '已退回到支付宝账户';
              } else {
                refundMessage = `支付宝退款失败(${result.message})，已退回到账户余额`;
              }
            } catch {
              refundMessage = '支付宝退款异常，已退回到账户余额';
            }
          }
        }

        // 执行退款（事务内）
        // 如果原路退款失败或余额支付，退回到用户余额
        if (refundMethod === 'balance' && refund.refundAmount > 0) {
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
        }

        // 更新退款状态
        refund.status = RefundStatus.REFUNDED;
        refund.refundMethod = refundMethod;
        refund.operatorId = adminId;
        refund.refundAt = new Date();
        await manager.save(RefundOrder, refund);

        // 更新原订单状态
        if (refund.orderType === 'adoption') {
          const order = await manager.findOne(Order, { where: { id: refund.orderId } });
          if (order && order.status !== OrderStatus.REFUNDED) {
            order.status = OrderStatus.REFUNDED;
            await manager.save(Order, order);

            const adoption = await manager.findOne(Adoption, { where: { orderId: order.id } });
            if (adoption) {
              adoption.status = AdoptionStatus.TERMINATED;
              await manager.save(Adoption, adoption);

              // 取消关联的待审核/审核通过的买断订单
              await manager.createQueryBuilder()
                .update('redemption_orders' as any)
                .set({ status: 5 })
                .where('adoption_id = :adoptionId AND status IN (1, 2)', { adoptionId: adoption.id })
                .execute();
            }
          }
        }

        // 记录订单状态变更历史
        try {
          await this.orderStateService.transition(
            refund.orderId,
            OrderStatus.REFUNDED,
            { id: adminId, type: 'admin' },
            `退款审核通过，退款方式: ${refundMethod}`,
          );
        } catch (error) {
          this.logger.warn(`订单状态历史记录失败: ${refund.orderId}`, error);
        }

        await this.adminService.createAuditLog({
          adminId,
          adminName,
          module: 'refund',
          action: 'approve',
          targetType: 'refund',
          targetId: id,
          beforeData,
          afterData: { status: refund.status, remark, refundMethod },
          remark: `审核通过退款申请，退款金额: ¥${refund.refundAmount}，${refundMessage}`,
          ip,
        });

        // 发出退款完成事件
        this.eventEmitter.emit('order.refund.completed', new OrderRefundCompletedEvent(
          refund.orderId,
          refund.id,
          refundMethod,
          Number(refund.refundAmount),
        ));

        return refund;
      });
    });
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

    // 验证用户是否存在
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

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
      const userEntity = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (userEntity) {
        const beforeBalance = Number(userEntity.balance) || 0;
        const afterBalance = Math.round((beforeBalance + amount) * 100) / 100;
        userEntity.balance = afterBalance;
        await manager.save(userEntity);

        // 记录余额变动日志
        const balanceLog = manager.create('BalanceLog', {
          id: IdUtil.generate('BL'),
          userId,
          type: 3, // 退款
          amount,
          balanceBefore: beforeBalance,
          balanceAfter: afterBalance,
          relatedType: 'admin_refund',
          relatedId: refundEntity.id,
          remark: `管理员退款: ${refundEntity.refundNo}`,
        } as any);
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

            // 取消关联的待审核/审核通过的买断订单
            await manager.createQueryBuilder()
              .update('redemption_orders' as any)
              .set({ status: 5 })
              .where('adoption_id = :adoptionId AND status IN (1, 2)', { adoptionId: adoption.id })
              .execute();
          }
        }
      }

      // 记录审计日志（在事务内）
      const auditLog = manager.create(AuditLog, {
        id: IdUtil.generate('AL'),
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
    ).catch(err => console.error('发送退款通知失败:', err));

    return refund;
  }
}
