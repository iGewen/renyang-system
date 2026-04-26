import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FeedService } from '@/modules/feed/feed.service';
import { OrderService } from '@/modules/order/order.service';
import { AdoptionService } from '@/modules/adoption/adoption.service';
import { RedemptionService } from '@/modules/redemption/redemption.service';
import { RefundCompensationService } from '@/services/refund-compensation.service';
import { RedisService } from '@/common/utils/redis.service';

/**
 * 定时任务服务
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly feedService: FeedService,
    private readonly orderService: OrderService,
    private readonly adoptionService: AdoptionService,
    private readonly redemptionService: RedemptionService,
    private readonly refundCompensationService: RefundCompensationService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 每天凌晨1点生成饲料费账单
   * 安全修复：使用 try-finally 确保锁释放
   */
  @Cron('0 1 * * *')
  async generateFeedBills() {
    this.logger.log('开始生成饲料费账单...');

    const lockKey = 'task:generateFeedBills';
    const locked = await this.redisService.setNX(lockKey, '1', 300); // 5分钟锁

    if (!locked) {
      this.logger.log('生成饲料费账单任务正在执行中，跳过');
      return;
    }

    try {
      await this.feedService.generateFeedBills();
      this.logger.log('饲料费账单生成完成');
    } catch (error) {
      this.logger.error('生成饲料费账单失败:', error);
    } finally {
      // 安全修复：确保锁释放
      await this.redisService.del(lockKey);
    }
  }

  /**
   * 每天凌晨2点计算滞纳金
   * 安全修复：使用 try-finally 确保锁释放
   */
  @Cron('0 2 * * *')
  async calculateLateFees() {
    this.logger.log('开始计算滞纳金...');

    const lockKey = 'task:calculateLateFees';
    const locked = await this.redisService.setNX(lockKey, '1', 300);

    if (!locked) {
      this.logger.log('计算滞纳金任务正在执行中，跳过');
      return;
    }

    try {
      await this.feedService.calculateLateFees();
      this.logger.log('滞纳金计算完成');
    } catch (error) {
      this.logger.error('计算滞纳金失败:', error);
    } finally {
      // 安全修复：确保锁释放
      await this.redisService.del(lockKey);
    }
  }

  /**
   * 每5分钟检查并取消过期订单
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelExpiredOrders() {
    this.logger.debug('开始检查过期订单...');

    try {
      await this.orderService.cancelExpiredOrders();
      this.logger.debug('过期订单检查完成');
    } catch (error) {
      this.logger.error('检查过期订单失败:', error);
    }
  }

  /**
   * 每天凌晨3点检查领养状态
   * 安全修复：使用 try-finally 确保锁释放
   */
  @Cron('0 3 * * *')
  async checkAdoptionStatus() {
    this.logger.log('开始检查领养状态...');

    const lockKey = 'task:checkAdoptionStatus';
    const locked = await this.redisService.setNX(lockKey, '1', 300);

    if (!locked) {
      this.logger.log('检查领养状态任务正在执行中，跳过');
      return;
    }

    try {
      await this.adoptionService.checkAndUpdateStatus();
      this.logger.log('领养状态检查完成');
    } catch (error) {
      this.logger.error('检查领养状态失败:', error);
    } finally {
      // 安全修复：确保锁释放
      await this.redisService.del(lockKey);
    }
  }

  /**
   * 每小时清理过期的临时数据
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredData() {
    this.logger.log('开始清理过期数据...');

    try {
      // 清理过期的微信临时token
      // Redis scan and delete logic would go here
      // For simplicity, we're relying on Redis TTL

      this.logger.log('过期数据清理完成');
    } catch (error) {
      this.logger.error('清理过期数据失败:', error);
    }
  }

  /**
   * 每5分钟检查并取消过期的买断订单
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelExpiredRedemptions() {
    this.logger.debug('开始检查过期买断订单...');

    try {
      await this.redemptionService.cancelExpiredRedemptions();
      this.logger.debug('过期买断订单检查完成');
    } catch (error) {
      this.logger.error('检查过期买断订单失败:', error);
    }
  }

  /**
   * 每小时检查并补偿超时的退款订单
   * 保证退款最终一致性
   */
  @Cron(CronExpression.EVERY_HOUR)
  async compensateTimeoutRefunds() {
    this.logger.log('开始检查超时退款订单...');

    const lockKey = 'task:compensateTimeoutRefunds';
    const locked = await this.redisService.setNX(lockKey, '1', 600); // 10分钟锁

    if (!locked) {
      this.logger.log('退款补偿任务正在执行中，跳过');
      return;
    }

    try {
      const result = await this.refundCompensationService.compensateTimeoutRefunds();
      this.logger.log(`退款补偿完成: 处理 ${result.processed}, 成功 ${result.success}, 失败 ${result.failed}`);
    } catch (error) {
      this.logger.error('退款补偿失败:', error);
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  /**
   * 每小时检查订单状态异常
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAbnormalOrders() {
    this.logger.log('开始检查订单状态异常...');

    try {
      const result = await this.refundCompensationService.checkAbnormalOrders();
      if (result.count > 0) {
        this.logger.warn(`发现 ${result.count} 个异常订单`);
      }
    } catch (error) {
      this.logger.error('检查订单状态异常失败:', error);
    }
  }
}
