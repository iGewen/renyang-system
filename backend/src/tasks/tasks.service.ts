import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FeedService } from '@/modules/feed/feed.service';
import { OrderService } from '@/modules/order/order.service';
import { AdoptionService } from '@/modules/adoption/adoption.service';
import { RedisService } from '@/common/utils/redis.service';

/**
 * 定时任务服务
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private feedService: FeedService,
    private orderService: OrderService,
    private adoptionService: AdoptionService,
    private redisService: RedisService,
  ) {}

  /**
   * 每天凌晨1点生成饲料费账单
   */
  @Cron('0 1 * * *')
  async generateFeedBills() {
    this.logger.log('开始生成饲料费账单...');

    try {
      // 使用分布式锁防止重复执行
      const lockKey = 'task:generateFeedBills';
      const locked = await this.redisService.setNX(lockKey, '1', 300); // 5分钟锁

      if (!locked) {
        this.logger.log('生成饲料费账单任务正在执行中，跳过');
        return;
      }

      await this.feedService.generateFeedBills();

      await this.redisService.del(lockKey);
      this.logger.log('饲料费账单生成完成');
    } catch (error) {
      this.logger.error('生成饲料费账单失败:', error);
    }
  }

  /**
   * 每天凌晨2点计算滞纳金
   */
  @Cron('0 2 * * *')
  async calculateLateFees() {
    this.logger.log('开始计算滞纳金...');

    try {
      const lockKey = 'task:calculateLateFees';
      const locked = await this.redisService.setNX(lockKey, '1', 300);

      if (!locked) {
        this.logger.log('计算滞纳金任务正在执行中，跳过');
        return;
      }

      await this.feedService.calculateLateFees();

      await this.redisService.del(lockKey);
      this.logger.log('滞纳金计算完成');
    } catch (error) {
      this.logger.error('计算滞纳金失败:', error);
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
   */
  @Cron('0 3 * * *')
  async checkAdoptionStatus() {
    this.logger.log('开始检查领养状态...');

    try {
      const lockKey = 'task:checkAdoptionStatus';
      const locked = await this.redisService.setNX(lockKey, '1', 300);

      if (!locked) {
        this.logger.log('检查领养状态任务正在执行中，跳过');
        return;
      }

      await this.adoptionService.checkAndUpdateStatus();

      await this.redisService.del(lockKey);
      this.logger.log('领养状态检查完成');
    } catch (error) {
      this.logger.error('检查领养状态失败:', error);
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
      const pattern = 'wechat:temp:*';
      // Redis scan and delete logic would go here
      // For simplicity, we're relying on Redis TTL

      this.logger.log('过期数据清理完成');
    } catch (error) {
      this.logger.error('清理过期数据失败:', error);
    }
  }
}
