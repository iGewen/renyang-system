import { OrderStatus } from '@/entities';

/**
 * 订单状态转换矩阵
 * 定义每个状态允许转换到的目标状态
 *
 * 设计原则：
 * - 显式定义合法转换，让规则一目了然
 * - 终态（REFUNDED, CANCELLED, ADMIN_CANCELLED）不允许再转换
 * - 买断状态不在 Order 中，因为买断是独立的 RedemptionOrder 实体
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PAID, // 支付成功
    OrderStatus.CANCELLED, // 超时自动取消
    OrderStatus.ADMIN_CANCELLED, // 管理员强制取消
  ],
  [OrderStatus.PAID]: [
    OrderStatus.REFUND_REVIEW, // 用户申请退款
    OrderStatus.REFUND_PROCESSING, // 管理员强制退款（跳过审核）
    OrderStatus.ADMIN_CANCELLED, // 管理员特殊操作
  ],
  [OrderStatus.CANCELLED]: [], // 终态
  [OrderStatus.REFUNDED]: [], // 终态
  [OrderStatus.REFUND_REVIEW]: [
    OrderStatus.REFUND_PROCESSING, // 审核通过
    OrderStatus.PAID, // 审核拒绝，恢复
  ],
  [OrderStatus.REFUND_PROCESSING]: [
    OrderStatus.REFUNDED, // 退款成功
    OrderStatus.REFUND_FAILED, // 退款失败
  ],
  [OrderStatus.REFUND_FAILED]: [
    OrderStatus.REFUND_PROCESSING, // 重试
  ],
  [OrderStatus.ADMIN_CANCELLED]: [], // 终态
};

/**
 * 检查状态转换是否合法
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowedTargets = ALLOWED_ORDER_TRANSITIONS[from];
  return allowedTargets?.includes(to) ?? false;
}

/**
 * 获取状态描述
 */
export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REFUNDED]: '已退款',
  [OrderStatus.REFUND_REVIEW]: '退款审核中',
  [OrderStatus.REFUND_PROCESSING]: '退款处理中',
  [OrderStatus.REFUND_FAILED]: '退款失败',
  [OrderStatus.ADMIN_CANCELLED]: '管理员强制取消',
};

/**
 * 判断是否为终态
 */
export function isFinalStatus(status: OrderStatus): boolean {
  return [
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
    OrderStatus.ADMIN_CANCELLED,
  ].includes(status);
}

/**
 * 判断是否为退款相关状态
 */
export function isRefundStatus(status: OrderStatus): boolean {
  return [
    OrderStatus.REFUND_REVIEW,
    OrderStatus.REFUND_PROCESSING,
    OrderStatus.REFUND_FAILED,
    OrderStatus.REFUNDED,
  ].includes(status);
}
