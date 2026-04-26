import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrderRefundRequestedEvent,
  OrderRefundApprovedEvent,
  OrderRefundRejectedEvent,
  OrderRefundProcessingEvent,
  OrderRefundCompletedEvent,
  OrderRefundFailedEvent,
} from './order-refund.events';
import { Order, OrderHistory, RefundOrder } from '@/entities';
import { NotificationService } from '@/modules/notification/notification.service';
import { QueueService } from '@/queue/queue.service';
import { IdUtil } from '@/common/utils/id.util';
import { OrderStatus } from '@/entities';

@Injectable()
export class OrderRefundEventHandler {
  private readonly logger = new Logger(OrderRefundEventHandler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly orderHistoryRepository: Repository<OrderHistory>,
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    private readonly notificationService: NotificationService,
    private readonly queueService: QueueService,
  ) {}

  @OnEvent('order.refund.requested')
  async handleRefundRequested(event: OrderRefundRequestedEvent) {
    this.logger.log(`处理退款申请事件: orderId=${event.orderId}, refundId=${event.refundId}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.PAID,
      OrderStatus.REFUND_REVIEW,
      { id: event.userId, type: 'user' },
      event.reason,
    );

    await this.queueService.createInAppNotificationAsync({
      userId: event.userId,
      title: '退款申请已提交',
      content: `您的退款申请已提交，请等待管理员审核。订单号: ${event.orderId}`,
      type: 'order',
      relatedType: 'refund',
      relatedId: event.refundId,
    });
  }

  @OnEvent('order.refund.approved')
  async handleRefundApproved(event: OrderRefundApprovedEvent) {
    this.logger.log(`处理退款审核通过事件: orderId=${event.orderId}, refundId=${event.refundId}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.REFUND_REVIEW,
      OrderStatus.REFUND_PROCESSING,
      { id: event.adminId, type: 'admin' },
      event.remark,
    );

    // 向退款队列添加任务
    await this.queueService.executeRefundAsync({
      refundId: event.refundId,
      adminId: event.adminId,
      adminName: event.adminName,
      remark: event.remark,
    });
  }

  @OnEvent('order.refund.rejected')
  async handleRefundRejected(event: OrderRefundRejectedEvent) {
    this.logger.log(`处理退款审核拒绝事件: orderId=${event.orderId}, refundId=${event.refundId}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.REFUND_REVIEW,
      OrderStatus.PAID,
      { id: event.adminId, type: 'admin' },
      event.remark,
    );

    const refund = await this.refundOrderRepository.findOne({ where: { id: event.refundId } });

    await this.queueService.createInAppNotificationAsync({
      userId: refund?.userId,
      title: '退款申请已拒绝',
      content: `您的退款申请未通过审核。${event.remark ? `原因: ${event.remark}` : ''}`,
      type: 'order',
      relatedType: 'refund',
      relatedId: event.refundId,
    });
  }

  @OnEvent('order.refund.processing')
  async handleRefundProcessing(event: OrderRefundProcessingEvent) {
    this.logger.log(`处理退款处理中事件: orderId=${event.orderId}, refundId=${event.refundId}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.REFUND_REVIEW,
      OrderStatus.REFUND_PROCESSING,
      { type: 'system' },
      event.gatewayTransactionId ? `网关交易号: ${event.gatewayTransactionId}` : undefined,
    );
  }

  @OnEvent('order.refund.completed')
  async handleRefundCompleted(event: OrderRefundCompletedEvent) {
    this.logger.log(`处理退款完成事件: orderId=${event.orderId}, refundId=${event.refundId}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.REFUND_PROCESSING,
      OrderStatus.REFUNDED,
      { type: 'system' },
      `退款金额: ¥${event.refundAmount}, 方式: ${event.refundMethod}`,
    );

    const refund = await this.refundOrderRepository.findOne({ where: { id: event.refundId } });

    await this.queueService.createInAppNotificationAsync({
      userId: refund?.userId,
      title: '退款已完成',
      content: `您的退款已处理完成，金额 ¥${event.refundAmount} 已${this.getRefundMethodText(event.refundMethod)}。`,
      type: 'order',
      relatedType: 'refund',
      relatedId: event.refundId,
    });
  }

  @OnEvent('order.refund.failed')
  async handleRefundFailed(event: OrderRefundFailedEvent) {
    this.logger.warn(`处理退款失败事件: orderId=${event.orderId}, refundId=${event.refundId}, reason=${event.reason}`);

    await this.recordHistory(
      event.orderId,
      OrderStatus.REFUND_PROCESSING,
      OrderStatus.REFUND_FAILED,
      { type: 'system' },
      `退款失败: ${event.reason}, 重试次数: ${event.retryCount}`,
    );
  }

  private async recordHistory(
    orderId: string,
    fromStatus: number,
    toStatus: number,
    operator: { id?: string; type: string },
    remark?: string,
  ): Promise<void> {
    const history = this.orderHistoryRepository.create({
      id: IdUtil.generate('OH'),
      orderId,
      fromStatus,
      toStatus,
      operatorId: operator.id,
      operatorType: operator.type,
      remark,
    });
    await this.orderHistoryRepository.save(history);
  }

  private getRefundMethodText(method: string): string {
    const map: Record<string, string> = {
      alipay: '退回支付宝账户',
      wechat: '退回微信账户',
      balance: '退回账户余额',
    };
    return map[method] || '退款';
  }
}
