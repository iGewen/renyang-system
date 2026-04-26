// ==================== 状态枚举 ====================
// 与后端保持一致的数字枚举

// ==================== 家畜类型常量 ====================
// 定义家畜类型的标准化常量，避免硬编码字符串
export const LIVESTOCK_TYPES = {
  SHEEP: 'sheep',
  CHICKEN: 'chicken',
  OSTRICH: 'ostrich',
} as const;

// 家畜类型联合类型
export type LivestockTypeCode = typeof LIVESTOCK_TYPES[keyof typeof LIVESTOCK_TYPES];

// 家畜类型显示名称映射
export const LIVESTOCK_TYPE_NAMES: Record<LivestockTypeCode, string> = {
  [LIVESTOCK_TYPES.SHEEP]: '羊',
  [LIVESTOCK_TYPES.CHICKEN]: '鸡',
  [LIVESTOCK_TYPES.OSTRICH]: '鸵鸟',
};

// 用户状态
export enum UserStatus {
  NORMAL = 1,      // 正常
  RESTRICTED = 2,  // 限制
  BANNED = 3,      // 封禁
}

// 订单状态
export enum OrderStatus {
  PENDING_PAYMENT = 1,  // 待支付
  PAID = 2,             // 已支付
  CANCELLED = 3,        // 已取消
  REFUNDED = 4,         // 已退款
  REFUND_REVIEW = 5,    // 退款审核中
  REFUND_PROCESSING = 6, // 退款处理中
  REFUND_FAILED = 7,    // 退款失败
  ADMIN_CANCELLED = 8,  // 管理员强制取消
}

// 领养状态
export enum AdoptionStatus {
  ACTIVE = 1,              // 领养中
  FEED_OVERDUE = 2,        // 饲料费逾期
  EXCEPTION = 3,           // 异常
  REDEEMABLE = 4,          // 可买断
  REDEMPTION_PENDING = 5,  // 买断审核中
  REDEEMED = 6,            // 已买断
  TERMINATED = 7,          // 已终止
}

// 饲料费账单状态
export enum FeedBillStatus {
  PENDING = 1,  // 待支付
  PAID = 2,     // 已支付
  OVERDUE = 3,  // 逾期
  WAIVED = 4,   // 已豁免
}

// 买断订单状态
export enum RedemptionStatus {
  PENDING_AUDIT = 1,   // 待审核
  AUDIT_PASSED = 2,    // 审核通过
  AUDIT_REJECTED = 3,  // 审核拒绝
  PAID = 4,            // 已支付
  CANCELLED = 5,       // 已取消
}

// 退款状态
export enum RefundStatus {
  PENDING_AUDIT = 1,   // 待审核
  AUDIT_PASSED = 2,    // 审核通过
  AUDIT_REJECTED = 3,  // 审核拒绝
  REFUNDED = 4,        // 已退款
  CANCELLED = 5,       // 已取消
}

// 支付状态
export enum PaymentStatus {
  PENDING = 1,  // 待支付
  SUCCESS = 2,  // 支付成功
  FAILED = 3,   // 支付失败
  CLOSED = 4,   // 已关闭
}

// 活体状态
export enum LivestockStatus {
  ON_SALE = 1,   // 在售
  OFF_SALE = 2,  // 下架
}

// 活体类型状态
export enum LivestockTypeStatus {
  ENABLED = 1,   // 启用
  DISABLED = 2,  // 禁用
}

// 管理员状态
export enum AdminStatus {
  ENABLED = 1,   // 启用
  DISABLED = 2,  // 禁用
}

// 余额变动类型
export enum BalanceLogType {
  RECHARGE = 1,  // 充值
  CONSUME = 2,   // 消费
  REFUND = 3,    // 退款
  ADJUST = 4,    // 调整
}

// 通知类型
export enum NotificationType {
  SYSTEM = 1,       // 系统通知
  ORDER = 2,        // 订单通知
  FEED = 3,         // 饲料费通知
  REDEMPTION = 4,   // 买断通知
  BALANCE = 5,      // 余额通知
}

// ==================== 状态映射工具 ====================

// 用户状态映射
export const UserStatusMap: Record<number, string> = {
  [UserStatus.NORMAL]: '正常',
  [UserStatus.RESTRICTED]: '限制',
  [UserStatus.BANNED]: '封禁',
};

// 订单状态映射
export const OrderStatusMap: Record<number, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REFUNDED]: '已退款',
  [OrderStatus.REFUND_REVIEW]: '退款审核中',
  [OrderStatus.REFUND_PROCESSING]: '退款处理中',
  [OrderStatus.REFUND_FAILED]: '退款失败',
  [OrderStatus.ADMIN_CANCELLED]: '管理员强制取消',
};

// 领养状态映射
export const AdoptionStatusMap: Record<number, string> = {
  [AdoptionStatus.ACTIVE]: '领养中',
  [AdoptionStatus.FEED_OVERDUE]: '饲料费逾期',
  [AdoptionStatus.EXCEPTION]: '异常',
  [AdoptionStatus.REDEEMABLE]: '可买断',
  [AdoptionStatus.REDEMPTION_PENDING]: '买断审核中',
  [AdoptionStatus.REDEEMED]: '已买断',
  [AdoptionStatus.TERMINATED]: '已终止',
};

// 饲料费状态映射
export const FeedBillStatusMap: Record<number, string> = {
  [FeedBillStatus.PENDING]: '待支付',
  [FeedBillStatus.PAID]: '已支付',
  [FeedBillStatus.OVERDUE]: '逾期',
  [FeedBillStatus.WAIVED]: '已豁免',
};

// 买断状态映射
export const RedemptionStatusMap: Record<number, string> = {
  [RedemptionStatus.PENDING_AUDIT]: '待审核',
  [RedemptionStatus.AUDIT_PASSED]: '审核通过',
  [RedemptionStatus.AUDIT_REJECTED]: '审核拒绝',
  [RedemptionStatus.PAID]: '已支付',
  [RedemptionStatus.CANCELLED]: '已取消',
};

// 退款状态映射
export const RefundStatusMap: Record<number, string> = {
  [RefundStatus.PENDING_AUDIT]: '待审核',
  [RefundStatus.AUDIT_PASSED]: '审核通过',
  [RefundStatus.AUDIT_REJECTED]: '审核拒绝',
  [RefundStatus.REFUNDED]: '已退款',
  [RefundStatus.CANCELLED]: '已取消',
};

// 支付状态映射
export const PaymentStatusMap: Record<number, string> = {
  [PaymentStatus.PENDING]: '待支付',
  [PaymentStatus.SUCCESS]: '支付成功',
  [PaymentStatus.FAILED]: '支付失败',
  [PaymentStatus.CLOSED]: '已关闭',
};

// 获取状态文本
export function getUserStatusText(status: number): string {
  return UserStatusMap[status] || '未知';
}

export function getOrderStatusText(status: number): string {
  return OrderStatusMap[status] || '未知';
}

export function getAdoptionStatusText(status: number): string {
  return AdoptionStatusMap[status] || '未知';
}

export function getFeedBillStatusText(status: number): string {
  return FeedBillStatusMap[status] || '未知';
}

export function getRedemptionStatusText(status: number): string {
  return RedemptionStatusMap[status] || '未知';
}

export function getRefundStatusText(status: number): string {
  return RefundStatusMap[status] || '未知';
}

export function getPaymentStatusText(status: number): string {
  return PaymentStatusMap[status] || '未知';
}
