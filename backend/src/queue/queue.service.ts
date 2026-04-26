import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';

/**
 * 队列服务 - 提供便捷的作业投递方法
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REFUND_PROCESS)
    private readonly refundQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DELAYED_TASKS)
    private readonly delayedTasksQueue: Queue,
  ) {}

  // =============== 通知队列 ===============

  /**
   * 异步发送短信验证码
   */
  async sendSmsAsync(phone: string, type: string) {
    return this.notificationQueue.add(JOB_NAMES.SEND_SMS, { phone, type });
  }

  /**
   * 异步发送微信模板消息
   */
  async sendWechatTemplateAsync(method: string, params: any) {
    return this.notificationQueue.add(JOB_NAMES.SEND_WECHAT_TEMPLATE, { method, params });
  }

  /**
   * 异步创建站内信
   */
  async createInAppNotificationAsync(data: {
    userId?: string | null;
    title: string;
    content: string;
    type: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    return this.notificationQueue.add(JOB_NAMES.CREATE_IN_APP_NOTIFICATION, data);
  }

  // =============== 退款队列 ===============

  /**
   * 投递退款处理任务
   */
  async executeRefundAsync(data: {
    refundId: string;
    adminId: string;
    adminName: string;
    remark?: string;
  }) {
    return this.refundQueue.add(JOB_NAMES.EXECUTE_REFUND, data);
  }

  // =============== 延迟任务队列 ===============

  /**
   * 订单创建后15分钟自动取消
   */
  async scheduleOrderAutoCancel(orderId: string, delayMs: number = 15 * 60 * 1000) {
    return this.delayedTasksQueue.add(
      JOB_NAMES.ORDER_AUTO_CANCEL,
      { orderId },
      { delay: delayMs, jobId: `order-cancel:${orderId}` },
    );
  }

  /**
   * 买断审核通过后12小时自动取消（未支付）
   */
  async scheduleRedemptionAutoCancel(redemptionId: string, delayMs: number = 12 * 60 * 60 * 1000) {
    return this.delayedTasksQueue.add(
      JOB_NAMES.REDEMPTION_AUTO_CANCEL,
      { redemptionId },
      { delay: delayMs, jobId: `redemption-cancel:${redemptionId}` },
    );
  }
}
