// ==================== 基础类型 ====================

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// ==================== 用户相关 ====================

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  balance: number;
  status: 'normal' | 'restricted' | 'banned';
  wechatOpenId?: string;
  wechatUnionId?: string;
  lastLoginAt?: string;
  createdAt: string;
  stats?: {
    adoptions: number;
    days: number;
    saved: number;
  };
}

export interface BalanceLog {
  id: string;
  userId: string;
  type: 'recharge' | 'consume' | 'refund' | 'adjust';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedType?: string;
  relatedId?: string;
  remark?: string;
  createdAt: string;
}

// ==================== 活体相关 ====================

export interface LivestockType {
  id: string;
  name: string;
  code: string;
  icon?: string;
  sortOrder: number;
  status: 'enabled' | 'disabled';
}

export interface Livestock {
  id: string;
  name: string;
  typeId: string;
  typeName?: string;
  type: 'sheep' | 'chicken' | 'ostrich';
  price: number;
  monthlyFeedFee: number;
  redemptionMonths: number;
  description: string;
  images: string[];
  mainImage: string;
  image: string; // 兼容旧字段
  stock: number;
  soldCount: number;
  status: 'on_sale' | 'off_sale';
  sortOrder: number;
}

// ==================== 订单相关 ====================

export interface AdoptionOrder {
  id: string;
  orderNo: string;
  userId: string;
  livestockId: string;
  livestockSnapshot: Livestock;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: 'alipay' | 'wechat' | 'balance';
  paymentNo?: string;
  paidAt?: string;
  status: 'pending_payment' | 'paid' | 'cancelled' | 'refunded';
  expireAt: string;
  cancelReason?: string;
  canceledAt?: string;
  createdAt: string;
}

// ==================== 领养相关 ====================

export interface Adoption {
  id: string;
  adoptionNo: string;
  orderId: string;
  userId: string;
  livestockId: string;
  livestockSnapshot: Livestock;
  livestock?: Livestock; // 兼容旧字段
  startDate: string;
  redemptionMonths: number;
  feedMonthsPaid: number;
  totalFeedAmount: number;
  lateFeeAmount: number;
  status: 'active' | 'feed_overdue' | 'exception' | 'redeemable' | 'redemption_pending' | 'redeemed' | 'terminated';
  currentFeedBillId?: string;
  isException: boolean;
  exceptionReason?: string;
  exceptionAt?: string;
  days?: number; // 已领养天数
  nextPayment?: string; // 下次付款日期
  createdAt: string;
}

// ==================== 饲料费相关 ====================

export interface FeedBill {
  id: string;
  billNo: string;
  adoptionId: string;
  userId: string;
  livestockId: string;
  billMonth: string;
  billDate: string;
  originalAmount: number;
  adjustedAmount?: number;
  lateFeeRate?: number;
  lateFeeCap?: number;
  lateFeeDays: number;
  lateFeeAmount: number;
  totalLateFee: number;
  lateFeeStartDate?: string;
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  paidAmount: number;
  paymentMethod?: string;
  paymentNo?: string;
  paidAt?: string;
  expireAt?: string;
  adjustReason?: string;
  operatorId?: string;
  createdAt: string;
  livestock?: Livestock;
}

// ==================== 买断相关 ====================

export interface RedemptionOrder {
  id: string;
  redemptionNo: string;
  adoptionId: string;
  userId: string;
  livestockId: string;
  type: 'full' | 'early';
  originalAmount: number;
  adjustedAmount?: number;
  finalAmount: number;
  adjustReason?: string;
  status: 'pending_audit' | 'audit_passed' | 'audit_rejected' | 'paid' | 'cancelled';
  auditAdminId?: string;
  auditAt?: string;
  auditRemark?: string;
  paidAmount: number;
  paymentMethod?: string;
  paymentNo?: string;
  paidAt?: string;
  expireAt?: string;
  createdAt: string;
  livestock?: Livestock;
}

// ==================== 退款相关 ====================

export interface RefundOrder {
  id: string;
  refundNo: string;
  userId: string;
  orderType: 'adoption' | 'feed' | 'redemption';
  orderId: string;
  originalAmount: number;
  refundAmount: number;
  refundLivestock: 'yes' | 'no';
  reason: string;
  type: 'user_apply' | 'admin_operate' | 'system_auto';
  status: 'pending_audit' | 'audit_passed' | 'audit_rejected' | 'refunded' | 'cancelled';
  auditAdminId?: string;
  auditAt?: string;
  auditRemark?: string;
  operatorId?: string;
  refundMethod?: string;
  refundAt?: string;
  createdAt: string;
}

// ==================== 支付相关 ====================

export interface PaymentResult {
  payUrl?: string;
  paymentNo: string;
}

// ==================== 消息相关 ====================

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  content: string;
  type: 'system' | 'order' | 'feed' | 'redemption' | 'balance';
  relatedType?: string;
  relatedId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ==================== 后台相关 ====================

export interface Admin {
  id: string;
  username: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'super_admin' | 'admin';
  status: 'enabled' | 'disabled';
  lastLoginAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  orderTotal: number;
  orderPaid: number;
  orderToday: number;
  orderMonth: number;
  orderYear: number;
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  refundCount: number;
  refundAmount: number;
  refundToday: number;
  adoptionByType: Array<{
    typeId: string;
    typeName: string;
    count: number;
  }>;
  pendingOrders: number;
  pendingRedemptions: number;
  exceptionAdoptions: number;
  pendingRefunds: number;
  userTotal: number;
  userToday: number;
  activeUsers: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeData?: any;
  afterData?: any;
  isSensitive: boolean;
  remark?: string;
  ip: string;
  createdAt: string;
}

// ==================== 系统配置相关 ====================

export interface SystemConfig {
  id: string;
  configKey: string;
  configValue: any;
  configType: 'payment' | 'sms' | 'business' | 'other';
  description: string;
  isEncrypted: boolean;
}

// ==================== 常量 ====================
// 注意：所有数据都从后端 API 获取，不再使用模拟数据
