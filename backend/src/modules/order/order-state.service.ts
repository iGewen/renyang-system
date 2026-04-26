import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, OrderHistory } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { canTransition, isFinalStatus, ORDER_STATUS_DESCRIPTIONS } from './order-state.config';

@Injectable()
export class OrderStateService {
  private readonly logger = new Logger(OrderStateService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly orderHistoryRepository: Repository<OrderHistory>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 执行状态转换（带分布式锁 + canTransition 校验）
   *
   * 流程：
   * 1. 加分布式锁（order:lock:{orderId}）
   * 2. 重查订单最新状态
   * 3. canTransition 校验
   * 4. 执行状态更新
   * 5. 记录订单历史
   * 6. 释放锁
   */
  async transition(
    orderId: string,
    toStatus: OrderStatus,
    operator: { id?: string; type: 'user' | 'admin' | 'system' },
    remark?: string,
  ): Promise<Order> {
    const lockKey = `order:lock:${orderId}`;

    return this.redisService.withLock(lockKey, 10, async () => {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new BadRequestException('订单不存在');
      }

      const fromStatus = order.status as OrderStatus;

      if (fromStatus === toStatus) {
        return order;
      }

      if (!canTransition(fromStatus, toStatus)) {
        throw new BadRequestException(
          `不允许从「${ORDER_STATUS_DESCRIPTIONS[fromStatus]}」转换为「${ORDER_STATUS_DESCRIPTIONS[toStatus]}」`,
        );
      }

      order.status = toStatus;
      await this.orderRepository.save(order);

      await this.recordHistory(orderId, fromStatus, toStatus, operator, remark);

      this.logger.log(
        `订单 ${orderId} 状态变更: ${ORDER_STATUS_DESCRIPTIONS[fromStatus]} → ${ORDER_STATUS_DESCRIPTIONS[toStatus]}`,
      );

      return order;
    });
  }

  /**
   * 检查状态转换是否合法（不加锁，仅校验）
   */
  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return canTransition(from, to);
  }

  /**
   * 判断是否为终态
   */
  isFinalStatus(status: OrderStatus): boolean {
    return isFinalStatus(status);
  }

  /**
   * 获取订单状态历史
   */
  async getHistory(orderId: string): Promise<OrderHistory[]> {
    return this.orderHistoryRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 记录订单历史
   */
  private async recordHistory(
    orderId: string,
    fromStatus: number | null,
    toStatus: number,
    operator: { id?: string; type: string },
    remark?: string,
  ): Promise<void> {
    const history = this.orderHistoryRepository.create({
      id: IdUtil.generate('OH'),
      orderId,
      fromStatus: fromStatus ?? undefined,
      toStatus,
      operatorId: operator.id,
      operatorType: operator.type,
      remark: remark,
    });
    await this.orderHistoryRepository.save(history);
  }
}
