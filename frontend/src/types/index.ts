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
  balance: string | number;  // 后端返回字符串
  status: number;  // 1正常 2限制 3封禁
  wechatOpenId?: string;
  wechatUnionId?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
  updatedAt?: string;
  stats?: {
    adoptions: number;
    days: number;
    saved: number;
  };
}

export interface BalanceLog {
  id: string;
  userId: string;
  type: number;  // 1充值 2消费 3退款 4调整
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedType?: string;
  relatedId?: string;
  remark?: string;
  operatorId?: string;
  createdAt: string;
}

// ==================== 活体相关 ====================

export interface LivestockType {
  id: string;
  name: string;
  code: string;
  icon?: string;
  sortOrder: number;
  status: number;  // 1启用 2禁用
  createdAt?: string;
  updatedAt?: string;
}

export interface Livestock {
  id: string;
  name: string;
  typeId: string;
  typeName?: string;
  type?: 'sheep' | 'chicken' | 'ostrich';  // 前端兼容字段
  price: number;
  monthlyFeedFee: number;
  redemptionMonths: number;
  description: string;
  images: string[];
  mainImage: string;
  image: string;  // 兼容旧字段
  stock: number;
  soldCount: number;
  status: number;  // 1在售 2下架
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== 订单相关 ====================

export interface Order {
  id: string;
  orderNo: string;
  userId: string;
  livestockId: string;
  livestockSnapshot: Livestock | null;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: string;
  paymentNo?: string;
  paidAt?: string;
  status: number;  // 1待支付 2已支付 3已取消 4已退款
  expireAt?: string;
  cancelReason?: string;
  canceledAt?: string;
  clientOrderId?: string;
  createdAt: string;
  updatedAt?: string;
}

// 兼容旧名称
export type AdoptionOrder = Order;

// ==================== 领养相关 ====================

export interface Adoption {
  id: string;
  adoptionNo: string;
  orderId: string;
  userId: string;
  livestockId: string;
  livestockSnapshot: Livestock | null;
  livestock?: Livestock;  // 兼容旧字段
  startDate: string;
  redemptionMonths: number;
  feedMonthsPaid: number;
  totalFeedAmount: number;
  lateFeeAmount: number;
  status: number;  // 1领养中 2饲料费逾期 3异常 4可买断 5买断审核中 6已买断 7已终止
  currentFeedBillId?: string;
  isException: number;  // 0否 1是
  exceptionReason?: string;
  exceptionAt?: string;
  days?: number;  // 已领养天数（计算字段）
  nextPayment?: string;  // 下次付款日期（计算字段）
  createdAt: string;
  updatedAt?: string;
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
  status: number;  // 1待支付 2已支付 3逾期 4已豁免
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
  type: number;  // 1=满期买断 2=提前买断（与后端RedemptionType枚举一致）
  originalAmount: number;
  adjustedAmount?: number;
  finalAmount: number;
  adjustReason?: string;
  status: number;  // 1待审核 2审核通过 3审核拒绝 4已支付 5已取消
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
  status: number;  // 1待审核 2审核通过 3审核拒绝 4已退款 5已取消
  auditAdminId?: string;
  auditAt?: string;
  auditRemark?: string;
  operatorId?: string;
  refundMethod?: string;
  refundAt?: string;
  createdAt: string;
}

// ==================== 支付相关 ====================

export interface PaymentRecord {
  id: string;
  paymentNo: string;
  outTradeNo: string;
  userId: string;
  orderType: 'adoption' | 'feed' | 'redemption' | 'recharge';
  orderId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat' | 'balance';
  status: number;  // 1待支付 2支付成功 3支付失败 4已关闭
  paidAt?: string;
  notifyAt?: string;
  notifyData?: any;
  createdAt: string;
}

export interface PaymentResult {
  success?: boolean;
  amount?: number;
  payUrl?: string;
  paymentNo?: string;
  redemptionNo?: string;
}

// ==================== 消息相关 ====================

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  content: string;
  type: string;  // system/order/feed/redemption/balance
  relatedType?: string;
  relatedId?: string;
  isRead: number;  // 0未读 1已读
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
  role: number;  // 1=超级管理员, 2=普通管理员
  status: number;  // 1启用 2禁用
  forceChangePassword?: boolean;  // 是否需要强制修改密码
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
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
  isSensitive: number;  // 0否 1是
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
  isEncrypted: number;  // 0否 1是
  createdAt?: string;
  updatedAt?: string;
}

// ==================== 协议相关 ====================

export interface Agreement {
  id: string;
  agreementKey: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 导出枚举和工具函数
export * from './enums';
