import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, RedemptionOrder, RedemptionStatus } from '@/entities';

@Processor(QUEUE_NAMES.DELAYED_TASKS)
export class DelayedTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(DelayedTasksProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(RedemptionOrder)
    private readonly redemptionRepository: Repository<RedemptionOrder>,
    private readonly dataSource: DataSource,
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
   * 双检锁：只有状态未变才执行取消
   */
  private async handleOrderAutoCancel(data: { orderId: string }) {
    const order = await this.orderRepository.findOne({ where: { id: data.orderId } });

    if (!order) {
      this.logger.warn(`订单不存在，跳过自动取消: ${data.orderId}`);
      return;
    }

    // 双检锁：只有待支付状态才执行取消
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      this.logger.log(`订单已非待支付状态，跳过自动取消: ${data.orderId}, 当前状态: ${order.status}`);
      return;
    }

    order.status = OrderStatus.CANCELLED;
    await this.orderRepository.save(order);

    // 恢复库存
    if (order.livestockId) {
      await this.dataSource.query(
        'UPDATE livestocks SET stock = stock + ? WHERE id = ?',
        [order.quantity || 1, order.livestockId],
      );
    }

    this.logger.log(`订单已自动取消: ${order.orderNo}`);
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
