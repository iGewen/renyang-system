import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, User, Livestock, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { LivestockService } from '../livestock/livestock.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    private redisService: RedisService,
    private livestockService: LivestockService,
    private dataSource: DataSource,
  ) {}

  async create(userId: string, livestockId: string, clientOrderId: string) {
    // 幂等性检查
    const idempotentKey = `order:idempotent:${clientOrderId}`;
    const exists = await this.redisService.exists(idempotentKey);
    if (exists) {
      const existingOrderId = await this.redisService.get(idempotentKey);
      if (existingOrderId) {
        return this.orderRepository.findOne({ where: { id: existingOrderId } });
      }
      return null;
    }

    // 分布式锁
    const lockKey = `order:lock:${userId}:${livestockId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      // 再次检查幂等性
      const existsAgain = await this.redisService.exists(idempotentKey);
      if (existsAgain) {
        const existingOrderId = await this.redisService.get(idempotentKey);
        if (existingOrderId) {
          return this.orderRepository.findOne({ where: { id: existingOrderId } });
        }
      }

      // 获取活体信息
      const livestock = await this.livestockService.getById(livestockId);
      if (!livestock) {
        throw new BadRequestException('活体不存在');
      }

      if (livestock.status !== 1) {
        throw new BadRequestException('活体已下架');
      }

      // 检查库存
      const stock = await this.livestockService.getStock(livestockId);
      if (stock <= 0) {
        throw new BadRequestException('活体已售罄');
      }

      // 预锁定库存
      const lockStockKey = `livestock:lock:${livestockId}:${clientOrderId}`;
      await this.redisService.set(lockStockKey, '1', 900); // 15分钟

      // 创建订单
      const order = this.orderRepository.create({
        id: IdUtil.generate('ORD'),
        orderNo: IdUtil.generateOrderNo(),
        userId,
        livestockId,
        livestockSnapshot: livestock,
        quantity: 1,
        totalAmount: livestock.price,
        paidAmount: 0,
        status: OrderStatus.PENDING_PAYMENT,
        expireAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟后过期
        clientOrderId,
      });

      await this.orderRepository.save(order);

      // 设置幂等键
      await this.redisService.set(idempotentKey, order.id, 3600);

      // 添加到延时队列（用于订单超时处理）
      const expireAt = Date.now() + 15 * 60 * 1000;
      await this.redisService.zadd('delay:queue:order', expireAt, order.id);

      return order;
    });
  }

  async cancel(userId: string, orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId, userId } });
    if (!order) {
      throw new BadRequestException('订单不存在');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('订单状态不允许取消');
    }

    // 更新订单状态
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = '用户主动取消';
    order.canceledAt = new Date();
    await this.orderRepository.save(order);

    // 释放库存锁
    if (order.clientOrderId) {
      const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
      await this.redisService.del(lockStockKey);
    }

    // 从延时队列移除
    await this.redisService.zrem('delay:queue:order', order.id);

    return order;
  }

  async getById(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) {
      where.userId = userId;
    }
    return this.orderRepository.findOne({ where, relations: ['livestock', 'user'] });
  }

  async getUserOrders(userId: string, status?: OrderStatus, page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .where('order.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    queryBuilder
      .orderBy('order.createdAt', 'DESC')
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

  async handlePaymentSuccess(orderId: string, paymentNo: string, paymentMethod: string) {
    console.log(`[OrderService.handlePaymentSuccess] Called with orderId=${orderId}, paymentNo=${paymentNo}, paymentMethod=${paymentMethod}`);

    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      console.error(`[OrderService.handlePaymentSuccess] Order not found: ${orderId}`);
      throw new BadRequestException('订单不存在');
    }

    console.log(`[OrderService.handlePaymentSuccess] Order found: id=${order.id}, status=${order.status}, totalAmount=${order.totalAmount}`);

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      console.log(`[OrderService.handlePaymentSuccess] Order already processed, status=${order.status}`);
      return order; // 已处理，幂等返回
    }

    console.log(`[OrderService.handlePaymentSuccess] Processing payment for order ${orderId}`);

    // 使用事务处理
    return this.dataSource.transaction(async (manager) => {
      console.log(`[OrderService.handlePaymentSuccess] Starting transaction for order ${orderId}`);

      // 更新订单状态
      order.status = OrderStatus.PAID;
      order.paidAt = new Date();
      order.paymentNo = paymentNo;
      order.paymentMethod = paymentMethod;
      order.paidAmount = order.totalAmount;
      await manager.save(order);
      console.log(`[OrderService.handlePaymentSuccess] Order status updated to PAID`);

      // 扣减库存
      try {
        await this.livestockService.updateStock(order.livestockId, -1);
        console.log(`[OrderService.handlePaymentSuccess] Stock deducted for livestock ${order.livestockId}`);
      } catch (error) {
        console.error(`[OrderService.handlePaymentSuccess] Failed to deduct stock:`, error);
      }

      // 释放库存锁
      if (order.clientOrderId) {
        const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
        await this.redisService.del(lockStockKey);
        console.log(`[OrderService.handlePaymentSuccess] Stock lock released`);
      }

      // 从延时队列移除
      await this.redisService.zrem('delay:queue:order', order.id);
      console.log(`[OrderService.handlePaymentSuccess] Removed from delay queue`);

      // 创建领养记录
      const livestock = order.livestockSnapshot;
      console.log(`[OrderService.handlePaymentSuccess] Creating adoption record for user ${order.userId}, livestock ${order.livestockId}`);

      const adoption = manager.create(Adoption, {
        id: IdUtil.generate('ADP'),
        adoptionNo: IdUtil.generateAdoptionNo(),
        orderId: order.id,
        userId: order.userId,
        livestockId: order.livestockId,
        livestockSnapshot: livestock,
        startDate: new Date(),
        redemptionMonths: livestock.redemptionMonths || 12,
        feedMonthsPaid: 0,
        totalFeedAmount: 0,
        lateFeeAmount: 0,
        status: AdoptionStatus.ACTIVE,
        isException: 0,
      });
      await manager.save(adoption);
      console.log(`[OrderService.handlePaymentSuccess] Adoption created: ${adoption.id}`);

      return order;
    }).catch(error => {
      console.error(`[OrderService.handlePaymentSuccess] Transaction failed:`, error);
      throw error;
    });
  }

  async handleOrderExpire(orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
      return;
    }

    // 更新订单状态
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = '订单超时自动取消';
    order.canceledAt = new Date();
    await this.orderRepository.save(order);

    // 释放库存锁
    if (order.clientOrderId) {
      const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
      await this.redisService.del(lockStockKey);
    }
  }

  /**
   * 取消过期订单（定时任务调用）
   */
  async cancelExpiredOrders() {
    const now = Date.now();

    // 从延时队列获取过期订单
    const expiredOrderIds = await this.redisService.zrangebyscore(
      'delay:queue:order',
      0,
      now,
    );

    if (!expiredOrderIds || expiredOrderIds.length === 0) {
      return;
    }

    for (const orderId of expiredOrderIds) {
      try {
        await this.handleOrderExpire(orderId);
        // 从延时队列移除
        await this.redisService.zrem('delay:queue:order', orderId);
      } catch (error) {
        console.error(`处理过期订单失败: ${orderId}`, error);
      }
    }
  }
}
