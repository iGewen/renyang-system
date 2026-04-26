import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';

/**
 * 队列事件监听器 - 监听业务事件并投递延迟任务
 */
@Injectable()
export class QueueEventListener implements OnModuleInit {
  private readonly logger = new Logger(QueueEventListener.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DELAYED_TASKS)
    private readonly delayedTasksQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('队列事件监听器已初始化');
  }

  /**
   * 监听买断审核通过事件，调度12小时后自动取消延迟任务
   */
  @OnEvent('redemption.audit-passed')
  async handleRedemptionAuditPassed(payload: { redemptionId: string }) {
    const { redemptionId } = payload;
    this.logger.log(`买断审核通过，调度12小时后自动取消任务: ${redemptionId}`);

    // 12小时 = 12 * 60 * 60 * 1000 = 43200000ms
    const delayMs = 12 * 60 * 60 * 1000;

    await this.delayedTasksQueue.add(
      JOB_NAMES.REDEMPTION_AUTO_CANCEL,
      { redemptionId },
      {
        delay: delayMs,
        jobId: `redemption-cancel:${redemptionId}`,
      },
    );

    this.logger.log(`已添加买断自动取消延迟任务: ${redemptionId}, 延迟: ${delayMs / 1000 / 60}分钟`);
  }
}
