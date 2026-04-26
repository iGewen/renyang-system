/**
 * 订单退款相关事件定义
 */

export class OrderRefundRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly userId: string,
    public readonly reason?: string,
  ) {}
}

export class OrderRefundApprovedEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly adminId: string,
    public readonly adminName: string,
    public readonly remark?: string,
  ) {}
}

export class OrderRefundRejectedEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly adminId: string,
    public readonly adminName: string,
    public readonly remark?: string,
  ) {}
}

export class OrderRefundProcessingEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly gatewayTransactionId?: string,
  ) {}
}

export class OrderRefundCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly refundMethod: string,
    public readonly refundAmount: number,
  ) {}
}

export class OrderRefundFailedEvent {
  constructor(
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly reason: string,
    public readonly retryCount: number,
  ) {}
}
