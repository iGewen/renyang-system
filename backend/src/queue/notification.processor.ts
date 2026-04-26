import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';
import { NotificationService } from '@/modules/notification/notification.service';
import { SmsService } from '@/services/sms.service';
import { WechatService } from '@/services/wechat.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly smsService: SmsService,
    private readonly wechatService: WechatService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`处理通知作业: ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case JOB_NAMES.SEND_SMS:
        return await this.handleSendSms(job.data);

      case JOB_NAMES.SEND_WECHAT_TEMPLATE:
        return await this.handleSendWechatTemplate(job.data);

      case JOB_NAMES.CREATE_IN_APP_NOTIFICATION:
        return await this.handleCreateInAppNotification(job.data);

      default:
        this.logger.warn(`未知的通知作业类型: ${job.name}`);
    }
  }

  private async handleSendSms(data: { phone: string; type: string }) {
    try {
      await this.smsService.sendVerificationCode(data.phone, data.type);
      this.logger.log(`短信发送成功: ${data.phone}`);
    } catch (error: any) {
      this.logger.error(`短信发送失败: ${data.phone} - ${error.message}`);
      throw error; // 让 BullMQ 重试
    }
  }

  private async handleSendWechatTemplate(data: {
    method: string;
    params: any;
  }) {
    try {
      const method = (this.wechatService as any)[data.method];
      if (typeof method === 'function') {
        await method.call(this.wechatService, data.params);
        this.logger.log(`微信模板消息发送成功: ${data.method}`);
      } else {
        this.logger.warn(`微信服务方法不存在: ${data.method}`);
      }
    } catch (error: any) {
      this.logger.error(`微信模板消息发送失败: ${data.method} - ${error.message}`);
      throw error;
    }
  }

  private async handleCreateInAppNotification(data: {
    userId?: string | null;
    title: string;
    content: string;
    type: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    try {
      await this.notificationService.createNotification(data);
      this.logger.log(`站内信创建成功: ${data.title}`);
    } catch (error: any) {
      this.logger.error(`站内信创建失败: ${data.title} - ${error.message}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`通知作业失败: ${job.name} (ID: ${job.id}, attempts: ${job.attemptsMade}) - ${err.message}`);
  }
}
