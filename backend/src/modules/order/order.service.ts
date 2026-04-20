import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, User, Livestock, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { LivestockService } from '../livestock/livestock.service';

// 常量定义
const ORDER_EXPIRE_MINUTES = 15;
const ORDER_EXPIRE_MS = ORDER_EXPIRE_MINUTES * 60 * 1000;
const EXPIRED_ORDER_BATCH_SIZE = 100; // 单次最多处理100个过期订单

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

    // 分布式锁 - 锁定用户和活体
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

      // 使用事务确保订单创建和库存操作的原子性
      const order = await this.dataSource.transaction(async (manager) => {
        // 安全修复：使用乐观锁原子更新库存，防止超卖
        const updateResult = await manager
          .createQueryBuilder()
          .update(Livestock)
          .set({
            stock: () => 'stock - 1',
            soldCount: () => 'soldCount + 1',
          })
          .where('id = :id AND stock > 0 AND status = 1', { id: livestockId })
          .execute();

        if (updateResult.affected === 0) {
          throw new BadRequestException('活体已售罄或已下架');
        }

        // 获取更新后的活体信息
        const livestock = await manager.findOne(Livestock, { where: { id: livestockId } });

        if (!livestock) {
          throw new BadRequestException('活体不存在');
        }

        // 创建订单
        const newOrder = manager.create(Order, {
          id: IdUtil.generate('ORD'),
          orderNo: IdUtil.generateOrderNo(),
          userId,
          livestockId,
          livestockSnapshot: livestock!,
          quantity: 1,
          totalAmount: livestock!.price,
          paidAmount: 0,
          status: OrderStatus.PENDING_PAYMENT,
          expireAt: new Date(Date.now() + ORDER_EXPIRE_MS),
          clientOrderId,
        });

        await manager.save(newOrder);

        return newOrder;
      });

      // 修复：Redis操作移到事务外执行，避免事务回滚但Redis已生效
      await this.redisService.set(idempotentKey, order.id, 3600);

      // 设置库存锁（用于订单取消时恢复）
      const lockStockKey = `livestock:lock:${livestockId}:${clientOrderId}`;
      await this.redisService.set(lockStockKey, '1', ORDER_EXPIRE_MS / 1000);

      // 添加到延时队列（用于订单超时处理）
      const expireTime = Date.now() + ORDER_EXPIRE_MS;
      await this.redisService.zadd('delay:queue:order', expireTime, order.id);

      return order;
    });
  }

  async cancel(userId: string, orderId: string) {
    // 使用分布式锁
    const lockKey = `order:cancel:${orderId}`;
    return this.redisService.withLock(lockKey, 10000, async () => {
      const order = await this.orderRepository.findOne({ where: { id: orderId, userId } });
      if (!order) {
        throw new BadRequestException('订单不存在');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException('订单状态不允许取消');
      }

      // 使用事务处理数据库操作
      await this.dataSource.transaction(async (manager) => {
        // 更新订单状态
        order.status = OrderStatus.CANCELLED;
        order.cancelReason = '用户主动取消';
        order.canceledAt = new Date();
        await manager.save(order);

        // 恢复库存
        await manager
          .createQueryBuilder()
          .update(Livestock)
          .set({
            stock: () => 'stock + 1',
            soldCount: () => 'GREATEST(soldCount - 1, 0)',
          })
          .where('id = :id', { id: order.livestockId })
          .execute();
      });

      // 修复：Redis操作移到事务外执行
      if (order.clientOrderId) {
        const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
        await this.redisService.del(lockStockKey);
      }
      await this.redisService.zrem('delay:queue:order', order.id);

      return order;
    });
  }

  /**
   * 根据订单ID获取订单（内部使用）
   * 安全修复：设为私有方法，不允许外部直接调用
   * 如需验证用户归属，请使用 getByIdForUser
   */
  private async getById(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) {
      where.userId = userId;
    }
    return this.orderRepository.findOne({ where, relations: ['livestock', 'user'] });
  }

  /**
   * 根据订单ID获取订单（强制验证用户归属）
   * 安全修复：移除可选的 userId 参数，强制验证
   */
  async getByIdForUser(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['livestock', 'user'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  async getUserOrders(userId: string, status?: OrderStatus, page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.adoption', 'adoption')
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
    // 使用分布式锁确保幂等性
    const lockKey = `order:payment:${orderId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new BadRequestException('订单不存在');
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        return order; // 已处理，幂等返回
      }

      // 使用事务处理数据库操作
      await this.dataSource.transaction(async (manager) => {
        // 更新订单状态
        order.status = OrderStatus.PAID;
        order.paidAt = new Date();
        order.paymentNo = paymentNo;
        order.paymentMethod = paymentMethod;
        order.paidAmount = order.totalAmount;
        await manager.save(order);

        // 创建领养记录
        const livestock = order.livestockSnapshot;

        // 每次领养都生成新的唯一领养编号
        const adoptionNo = IdUtil.generateLivestockNo();

        const adoption = manager.create(Adoption, {
          id: IdUtil.generate('ADP'),
          adoptionNo: adoptionNo,
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
      });

      // 修复：Redis操作移到事务外执行
      if (order.clientOrderId) {
        const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
        await this.redisService.del(lockStockKey);
      }
      await this.redisService.zrem('delay:queue:order', order.id);

      return order;
    });
  }

  async handleOrderExpire(orderId: string) {
    // 使用分布式锁确保幂等性
    const lockKey = `order:expire:${orderId}`;
    return this.redisService.withLock(lockKey, 10000, async () => {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
        return;
      }

      // 使用事务处理数据库操作
      await this.dataSource.transaction(async (manager) => {
        // 更新订单状态
        order.status = OrderStatus.CANCELLED;
        order.cancelReason = '订单超时自动取消';
        order.canceledAt = new Date();
        await manager.save(order);

        // 恢复库存
        await manager
          .createQueryBuilder()
          .update(Livestock)
          .set({
            stock: () => 'stock + 1',
            soldCount: () => 'GREATEST(soldCount - 1, 0)',
          })
          .where('id = :id', { id: order.livestockId })
          .execute();
      });

      // 修复：Redis操作移到事务外执行
      if (order.clientOrderId) {
        const lockStockKey = `livestock:lock:${order.livestockId}:${order.clientOrderId}`;
        await this.redisService.del(lockStockKey);
      }
    });
  }

  /**
   * 取消过期订单（定时任务调用）
   * 安全修复：添加批量处理限制
   */
  async cancelExpiredOrders() {
    const now = Date.now();

    // 从延时队列获取过期订单（限制每次最多处理100个）
    const expiredOrderIds = await this.redisService.zrangebyscore(
      'delay:queue:order',
      0,
      now,
      EXPIRED_ORDER_BATCH_SIZE,
    );

    if (!expiredOrderIds || expiredOrderIds.length === 0) {
      return;
    }

    // 并发处理过期订单
    const results = await Promise.allSettled(
      expiredOrderIds.map(async (orderId) => {
        try {
          await this.handleOrderExpire(orderId);
          // 从延时队列移除
          await this.redisService.zrem('delay:queue:order', orderId);
        } catch (error) {
          console.error(`处理过期订单失败: ${orderId}`, error);
        }
      }),
    );

    // 记录失败的订单
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`处理过期订单失败: ${expiredOrderIds[index]}`, result.reason);
      }
    });
  }
}
