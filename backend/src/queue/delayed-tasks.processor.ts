import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RedemptionOrder, RedemptionStatus } from '@/entities';
import { OrderService } from '@/modules/order/order.service';

@Processor(QUEUE_NAMES.DELAYED_TASKS)
export class DelayedTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(DelayedTasksProcessor.name);

  constructor(
    @InjectRepository(RedemptionOrder)
    private readonly redemptionRepository: Repository<RedemptionOrder>,
    private readonly dataSource: DataSource,
    private readonly orderService: OrderService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`处理延迟任务: ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case JOB_NAMES.ORDER_AUTO_CANCEL:
        return await this.handleOrderAutoCancel(job.data);

      case JOB_NAMES.REDEMPTION_AUTO_CANCEL:
        return await this.handleRedemptionAutoCancel(job.data);

      default:
        this.logger.warn(`未知的延迟任务类型: ${job.name}`);
    }
  }

  /**
   * 订单自动取消 - 创建15分钟后未支付则取消
   * 复用 OrderService.handleOrderExpire 方法确保逻辑一致
   */
  private async handleOrderAutoCancel(data: { orderId: string }) {
    try {
      await this.orderService.handleOrderExpire(data.orderId);
      this.logger.log(`订单自动取消处理完成: ${data.orderId}`);
    } catch (error) {
      this.logger.warn(`订单自动取消处理失败（可能已处理）: ${data.orderId}, ${error.message}`);
    }
  }

  /**
   * 买断自动取消 - 审核通过后12小时未支付则取消
   * 双检锁：只有审核通过状态才执行取消
   */
  private async handleRedemptionAutoCancel(data: { redemptionId: string }) {
    const redemption = await this.redemptionRepository.findOne({ where: { id: data.redemptionId } });

    if (!redemption) {
      this.logger.warn(`买断记录不存在，跳过自动取消: ${data.redemptionId}`);
      return;
    }

    // 双检锁：只有审核通过状态才执行取消
    if (redemption.status !== RedemptionStatus.AUDIT_PASSED) {
      this.logger.log(`买断已非审核通过状态，跳过自动取消: ${data.redemptionId}, 当前状态: ${redemption.status}`);
      return;
    }

    redemption.status = RedemptionStatus.CANCELLED;
    await this.redemptionRepository.save(redemption);

    this.logger.log(`买断已自动取消（超时未支付）: ${redemption.redemptionNo}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`延迟任务失败: ${job.name} (ID: ${job.id}) - ${err.message}`);
  }
}
