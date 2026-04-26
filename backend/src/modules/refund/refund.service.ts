import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundOrder, RefundType, RefundStatus, Order, OrderStatus, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { OrderRefundRequestedEvent } from '@/common/events';

@Injectable()
export class RefundService {

  constructor(
    @InjectRepository(RefundOrder)
    private readonly refundRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 用户申请退款
   * 使用统一的分布式锁，与审核阶段共用同一把锁，确保互斥
   */
  async applyRefund(
    userId: string,
    orderType: string,
    orderId: string,
    reason: string,
  ) {
    // 统一锁key，与审核阶段共用，确保申请和审核互斥
    const lockKey = `refund:lock:${orderType}:${orderId}`;
    return this.redisService.withLock(lockKey, 10000, async () => {
      return this.dataSource.transaction(async (manager) => {
        // 检查1：订单是否已退款
        if (orderType === 'adoption') {
          const order = await manager.findOne(Order, {
            where: { id: orderId },
            lock: { mode: 'pessimistic_write' },
          });
          if (order && order.status === OrderStatus.REFUNDED) {
            throw new BadRequestException('该订单已退款，无法再次申请');
          }
        }

        // 检查2：是否已有有效退款申请（待审核或审核通过）
        const existingRefund = await manager.findOne(RefundOrder, {
          where: {
            orderType,
            orderId,
            status: In([RefundStatus.PENDING_AUDIT, RefundStatus.AUDIT_PASSED]),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (existingRefund) {
          if (existingRefund.status === RefundStatus.PENDING_AUDIT) {
            throw new BadRequestException('已有待审核的退款申请，请等待处理');
          } else {
            throw new BadRequestException('该订单退款申请已审核通过，正在处理中');
          }
        }

        // 检查3：是否已有完成的退款记录（最终防线）
        const completedRefund = await manager.findOne(RefundOrder, {
          where: {
            orderType,
            orderId,
            status: RefundStatus.REFUNDED,
          },
        });
        if (completedRefund) {
          throw new BadRequestException('该订单已完成退款');
        }

        // 验证订单归属和状态
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

          adoption = await manager.findOne(Adoption, {
            where: { orderId: order.id },
          });

          if (adoption && adoption.status !== AdoptionStatus.ACTIVE) {
            throw new BadRequestException('领养状态不允许退款');
          }
        } else if (orderType === 'feed') {
          throw new BadRequestException('饲料费退款请联系客服处理');
        } else if (orderType === 'redemption') {
          throw new BadRequestException('买断订单不支持退款');
        } else {
          throw new BadRequestException('不支持的订单类型');
        }

        const refundLivestock = orderType === 'adoption' ? 1 : 0;

        // 创建退款订单
        const refund = manager.create(RefundOrder, {
          id: IdUtil.generate('RFD'),
          refundNo: IdUtil.generateRefundNo(),
          userId,
          orderType,
          orderId,
          originalAmount,
          refundAmount: originalAmount,
          refundLivestock,
          reason,
          type: RefundType.USER_APPLY,
          status: RefundStatus.PENDING_AUDIT,
        });

        await manager.save(refund);

        // 发出退款申请事件
        this.eventEmitter.emit('order.refund.requested', new OrderRefundRequestedEvent(
          orderId,
          refund.id,
          userId,
          reason,
        ));

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
}
