# 云端牧场项目 - 字段命名规范文档

## 目录
1. [数据库表结构](#数据库表结构)
2. [后端实体定义](#后端实体定义)
3. [前端类型定义](#前端类型定义)
4. [API接口规范](#api接口规范)
5. [枚举值定义](#枚举值定义)
6. [命名规则总览](#命名规则总览)

---

## 数据库表结构

### 表名命名规则
- 使用小写字母和下划线（snake_case）
- 表名使用复数形式
- 示例：`users`, `livestock`, `orders`, `feed_bills`

### 通用字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 主键ID，使用业务前缀+时间戳+随机数 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |
| `deleted_at` | DATETIME | 软删除时间 |

### 1. users 表（用户表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 用户ID，前缀 U |
| `phone` | VARCHAR(11) | 手机号（唯一） |
| `password` | VARCHAR(255) | 密码（加密存储） |
| `nickname` | VARCHAR(50) | 昵称 |
| `avatar` | VARCHAR(500) | 头像URL |
| `wechat_open_id` | VARCHAR(64) | 微信OpenID（唯一） |
| `wechat_union_id` | VARCHAR(64) | 微信UnionID |
| `balance` | DECIMAL(10,2) | 账户余额（元） |
| `status` | TINYINT | 状态：1正常 2限制 3封禁 |
| `last_login_at` | DATETIME | 最后登录时间 |
| `last_login_ip` | VARCHAR(45) | 最后登录IP |

### 2. admins 表（管理员表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 管理员ID，前缀 A |
| `username` | VARCHAR(50) | 用户名（唯一） |
| `password` | VARCHAR(255) | 密码（加密存储） |
| `name` | VARCHAR(50) | 姓名 |
| `phone` | VARCHAR(11) | 手机号 |
| `avatar` | VARCHAR(500) | 头像 |
| `role` | TINYINT | 角色：1超级管理员 2普通管理员 |
| `status` | TINYINT | 状态：1启用 2禁用 |
| `last_login_at` | DATETIME | 最后登录时间 |
| `last_login_ip` | VARCHAR(45) | 最后登录IP |

### 3. livestock_types 表（活体类型表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 类型ID，前缀 LT |
| `name` | VARCHAR(50) | 类型名称 |
| `code` | VARCHAR(20) | 类型编码（唯一） |
| `icon` | VARCHAR(500) | 图标URL |
| `sort_order` | INT | 排序 |
| `status` | TINYINT | 状态：1启用 2禁用 |

### 4. livestock 表（活体表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 活体ID，前缀 L |
| `name` | VARCHAR(100) | 活体名称 |
| `type_id` | VARCHAR(32) | 类型ID（外键） |
| `price` | DECIMAL(10,2) | 领养价格 |
| `monthly_feed_fee` | DECIMAL(10,2) | 月饲料费 |
| `redemption_months` | INT | 买断所需月数 |
| `description` | TEXT | 描述 |
| `images` | JSON | 图片列表 |
| `main_image` | VARCHAR(500) | 主图 |
| `stock` | INT | 库存数量 |
| `sold_count` | INT | 已售数量 |
| `status` | TINYINT | 状态：1上架 2下架 |
| `sort_order` | INT | 排序 |

### 5. orders 表（订单表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 订单ID，前缀 ORD |
| `order_no` | VARCHAR(32) | 订单编号（唯一） |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `livestock_id` | VARCHAR(32) | 活体ID（外键） |
| `livestock_snapshot` | JSON | 活体快照 |
| `quantity` | INT | 数量 |
| `total_amount` | DECIMAL(10,2) | 订单总金额 |
| `paid_amount` | DECIMAL(10,2) | 实付金额 |
| `payment_method` | VARCHAR(20) | 支付方式 |
| `payment_no` | VARCHAR(64) | 支付平台订单号 |
| `paid_at` | DATETIME | 支付时间 |
| `status` | TINYINT | 状态：1待支付 2已支付 3已取消 4已退款 |
| `expire_at` | DATETIME | 过期时间 |
| `cancel_reason` | VARCHAR(255) | 取消原因 |
| `canceled_at` | DATETIME | 取消时间 |
| `client_order_id` | VARCHAR(64) | 客户端幂等键 |

### 6. adoptions 表（领养记录表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 领养ID，前缀 ADP |
| `adoption_no` | VARCHAR(32) | 领养编号（唯一） |
| `order_id` | VARCHAR(32) | 订单ID（外键） |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `livestock_id` | VARCHAR(32) | 活体ID（外键） |
| `livestock_snapshot` | JSON | 活体快照 |
| `start_date` | DATE | 领养开始日期 |
| `redemption_months` | INT | 买断所需月数 |
| `feed_months_paid` | INT | 已缴纳饲料费月数 |
| `total_feed_amount` | DECIMAL(10,2) | 累计已缴饲料费 |
| `late_fee_amount` | DECIMAL(10,2) | 累计滞纳金 |
| `status` | TINYINT | 状态：1领养中 2饲料费逾期 3异常 4可买断 5买断审核中 6已买断 7已终止 |
| `current_feed_bill_id` | VARCHAR(64) | 当前饲料费账单ID |
| `is_exception` | TINYINT | 是否异常：0否 1是 |
| `exception_reason` | VARCHAR(255) | 异常原因 |
| `exception_at` | DATETIME | 异常标记时间 |

### 7. feed_bills 表（饲料费账单表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 饲料账单ID，前缀 FBL |
| `bill_no` | VARCHAR(32) | 账单编号（唯一） |
| `adoption_id` | VARCHAR(32) | 领养记录ID（外键） |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `livestock_id` | VARCHAR(32) | 活体ID（外键） |
| `bill_month` | VARCHAR(7) | 账单月份：2026-04 |
| `bill_date` | DATE | 账单日期 |
| `original_amount` | DECIMAL(10,2) | 原金额 |
| `adjusted_amount` | DECIMAL(10,2) | 调整后金额 |
| `late_fee_rate` | DECIMAL(5,4) | 滞纳金比例（日） |
| `late_fee_cap` | DECIMAL(10,2) | 滞纳金上限 |
| `late_fee_days` | INT | 逾期天数 |
| `late_fee_amount` | DECIMAL(10,2) | 滞纳金金额 |
| `total_late_fee` | DECIMAL(10,2) | 累计滞纳金 |
| `late_fee_start_date` | DATE | 滞纳金开始计算日期 |
| `status` | TINYINT | 状态：1待支付 2已支付 3逾期 4已豁免 |
| `paid_amount` | DECIMAL(10,2) | 实付金额 |
| `payment_method` | VARCHAR(20) | 支付方式 |
| `payment_no` | VARCHAR(64) | 支付平台订单号 |
| `paid_at` | DATETIME | 支付时间 |
| `expire_at` | DATETIME | 过期时间 |
| `adjust_reason` | VARCHAR(255) | 调整原因 |
| `operator_id` | VARCHAR(32) | 操作管理员ID |

### 8. redemption_orders 表（买断订单表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 买断订单ID，前缀 RDM |
| `redemption_no` | VARCHAR(32) | 买断编号（唯一） |
| `adoption_id` | VARCHAR(32) | 领养记录ID（外键） |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `livestock_id` | VARCHAR(32) | 活体ID（外键） |
| `type` | TINYINT | 类型：1满期买断 2提前买断 |
| `original_amount` | DECIMAL(10,2) | 原买断金额 |
| `adjusted_amount` | DECIMAL(10,2) | 调整后金额 |
| `final_amount` | DECIMAL(10,2) | 最终买断金额 |
| `adjust_reason` | VARCHAR(255) | 调整原因 |
| `status` | TINYINT | 状态：1待审核 2审核通过 3审核拒绝 4已支付 5已取消 |
| `audit_admin_id` | VARCHAR(32) | 审核管理员ID |
| `audit_at` | DATETIME | 审核时间 |
| `audit_remark` | VARCHAR(255) | 审核备注 |
| `paid_amount` | DECIMAL(10,2) | 实付金额 |
| `payment_method` | VARCHAR(20) | 支付方式 |
| `payment_no` | VARCHAR(64) | 支付平台订单号 |
| `paid_at` | DATETIME | 支付时间 |
| `expire_at` | DATETIME | 过期时间 |

### 9. payment_records 表（支付记录表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 支付记录ID，前缀 PAY |
| `payment_no` | VARCHAR(64) | 支付平台订单号（唯一） |
| `out_trade_no` | VARCHAR(32) | 商户订单号 |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `order_type` | VARCHAR(20) | 订单类型：adoption/feed/redemption/recharge |
| `order_id` | VARCHAR(32) | 订单ID |
| `amount` | DECIMAL(10,2) | 支付金额 |
| `payment_method` | VARCHAR(20) | 支付方式：alipay/wechat/balance |
| `status` | TINYINT | 状态：1待支付 2支付成功 3支付失败 4已关闭 |
| `paid_at` | DATETIME | 支付时间 |
| `notify_at` | DATETIME | 回调时间 |
| `notify_data` | JSON | 回调数据 |

### 10. balance_logs 表（余额流水表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 余额日志ID，前缀 BL |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `type` | TINYINT | 类型：1充值 2消费 3退款 4调整 |
| `amount` | DECIMAL(10,2) | 变动金额 |
| `balance_before` | DECIMAL(10,2) | 变动前余额 |
| `balance_after` | DECIMAL(10,2) | 变动后余额 |
| `related_type` | VARCHAR(20) | 关联类型 |
| `related_id` | VARCHAR(64) | 关联ID |
| `remark` | VARCHAR(255) | 备注 |
| `operator_id` | VARCHAR(32) | 操作管理员ID |

### 11. notifications 表（消息通知表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 通知ID，前缀 N |
| `user_id` | VARCHAR(32) | 用户ID（为空则全员） |
| `title` | VARCHAR(100) | 标题 |
| `content` | TEXT | 内容 |
| `type` | VARCHAR(20) | 类型：system/order/feed/redemption/balance |
| `related_type` | VARCHAR(20) | 关联类型 |
| `related_id` | VARCHAR(64) | 关联ID |
| `is_read` | TINYINT | 是否已读：0否 1是 |
| `read_at` | DATETIME | 阅读时间 |

### 12. refund_orders 表（退款订单表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(32) | 退款订单ID，前缀 RFD |
| `refund_no` | VARCHAR(32) | 退款编号（唯一） |
| `user_id` | VARCHAR(32) | 用户ID（外键） |
| `order_type` | VARCHAR(20) | 订单类型：adoption/feed/redemption |
| `order_id` | VARCHAR(32) | 原订单ID |
| `original_amount` | DECIMAL(10,2) | 原订单金额 |
| `refund_amount` | DECIMAL(10,2) | 退款金额 |
| `refund_livestock` | TINYINT | 是否退活体：1是 2否 |
| `reason` | VARCHAR(255) | 退款原因 |
| `type` | TINYINT | 类型：1用户申请 2管理员操作 3系统自动 |
| `status` | TINYINT | 状态：1待审核 2审核通过 3审核拒绝 4已退款 5已取消 |
| `audit_admin_id` | VARCHAR(32) | 审核管理员ID |
| `audit_at` | DATETIME | 审核时间 |
| `audit_remark` | VARCHAR(255) | 审核备注 |
| `operator_id` | VARCHAR(32) | 操作管理员ID |
| `refund_method` | VARCHAR(20) | 退款方式 |
| `refund_at` | DATETIME | 退款完成时间 |

### 13. sms_codes 表（短信验证码表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 主键ID |
| `phone` | VARCHAR(11) | 手机号 |
| `code` | VARCHAR(6) | 验证码 |
| `type` | VARCHAR(20) | 类型：register/login/reset_password |
| `is_used` | TINYINT | 是否已使用：0否 1是 |
| `expire_at` | DATETIME | 过期时间 |

### 14. system_configs 表（系统配置表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 主键ID |
| `config_key` | VARCHAR(50) | 配置键（唯一） |
| `config_value` | TEXT | 配置值（JSON） |
| `config_type` | VARCHAR(20) | 配置类型：payment/sms/business/other/agreement |
| `description` | VARCHAR(255) | 配置说明 |
| `is_encrypted` | TINYINT | 是否加密：0否 1是 |

### 15. audit_logs 表（审计日志表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | INT | 主键ID（自增） |
| `admin_id` | VARCHAR(32) | 管理员ID |
| `admin_name` | VARCHAR(50) | 管理员用户名 |
| `module` | VARCHAR(50) | 模块 |
| `action` | VARCHAR(50) | 操作 |
| `target_type` | VARCHAR(50) | 目标类型 |
| `target_id` | VARCHAR(64) | 目标ID |
| `before_data` | JSON | 操作前数据 |
| `after_data` | JSON | 操作后数据 |
| `is_sensitive` | TINYINT | 是否敏感操作：0否 1是 |
| `remark` | VARCHAR(500) | 备注 |
| `ip` | VARCHAR(45) | 操作IP |
| `user_agent` | VARCHAR(500) | 浏览器UA |

---

## 后端实体定义

### 枚举类型（TypeScript）

```typescript
// 订单状态
export enum OrderStatus {
  PENDING_PAYMENT = 1,  // 待支付
  PAID = 2,             // 已支付
  CANCELLED = 3,        // 已取消
  REFUNDED = 4,         // 已退款
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

// 买断类型
export enum RedemptionType {
  FULL = 1,   // 满期买断
  EARLY = 2,  // 提前买断
}

// 买断状态
export enum RedemptionStatus {
  PENDING_AUDIT = 1,   // 待审核
  AUDIT_PASSED = 2,    // 审核通过
  AUDIT_REJECTED = 3,  // 审核拒绝
  PAID = 4,            // 已支付
  CANCELLED = 5,       // 已取消
}

// 支付状态
export enum PaymentStatus {
  PENDING = 1,  // 待支付
  SUCCESS = 2,  // 支付成功
  FAILED = 3,   // 支付失败
  CLOSED = 4,   // 已关闭
}

// 退款类型
export enum RefundType {
  USER_APPLY = 1,     // 用户申请
  ADMIN_OPERATE = 2,  // 管理员操作
  SYSTEM_AUTO = 3,    // 系统自动
}

// 退款状态
export enum RefundStatus {
  PENDING_AUDIT = 1,   // 待审核
  AUDIT_PASSED = 2,    // 审核通过
  AUDIT_REJECTED = 3,  // 审核拒绝
  REFUNDED = 4,        // 已退款
  CANCELLED = 5,       // 已取消
}

// 用户状态
export enum UserStatus {
  NORMAL = 1,      // 正常
  RESTRICTED = 2,  // 限制
  BANNED = 3,      // 封禁
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
```

---

## 前端类型定义

### 接口定义（TypeScript）

```typescript
// 用户
interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  balance: string | number;
  status: number;
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

// 活体
interface Livestock {
  id: string;
  name: string;
  typeId: string;
  typeName?: string;
  price: number;
  monthlyFeedFee: number;
  redemptionMonths: number;
  description: string;
  images: string[];
  mainImage: string;
  stock: number;
  soldCount: number;
  status: number;
  sortOrder: number;
}

// 活体类型
interface LivestockType {
  id: string;
  name: string;
  code: string;
  icon?: string;
  sortOrder: number;
  status: number;
}

// 订单
interface Order {
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
  status: number;
  expireAt?: string;
  cancelReason?: string;
  canceledAt?: string;
  clientOrderId?: string;
  createdAt: string;
}

// 领养记录
interface Adoption {
  id: string;
  adoptionNo: string;
  orderId: string;
  userId: string;
  livestockId: string;
  livestockSnapshot: Livestock | null;
  livestock?: Livestock;
  startDate: string;
  redemptionMonths: number;
  feedMonthsPaid: number;
  totalFeedAmount: number;
  lateFeeAmount: number;
  status: number;
  currentFeedBillId?: string;
  isException: number;
  exceptionReason?: string;
  exceptionAt?: string;
  days?: number;
  nextPayment?: string;
  createdAt: string;
}

// 饲料费账单
interface FeedBill {
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
  status: number;
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

// 买断订单
interface RedemptionOrder {
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
  status: number;
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

// 支付记录
interface PaymentRecord {
  id: string;
  paymentNo: string;
  outTradeNo: string;
  userId: string;
  orderType: 'adoption' | 'feed' | 'redemption' | 'recharge';
  orderId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat' | 'balance';
  status: number;
  paidAt?: string;
  notifyAt?: string;
  notifyData?: any;
  createdAt: string;
}

// 余额流水
interface BalanceLog {
  id: string;
  userId: string;
  type: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedType?: string;
  relatedId?: string;
  remark?: string;
  operatorId?: string;
  createdAt: string;
}

// 消息通知
interface Notification {
  id: string;
  userId?: string;
  title: string;
  content: string;
  type: string;
  relatedType?: string;
  relatedId?: string;
  isRead: number;
  readAt?: string;
  createdAt: string;
}

// 退款订单
interface RefundOrder {
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
  status: number;
  auditAdminId?: string;
  auditAt?: string;
  auditRemark?: string;
  operatorId?: string;
  refundMethod?: string;
  refundAt?: string;
  createdAt: string;
}

// 管理员
interface Admin {
  id: string;
  username: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'super_admin' | 'admin';
  status: number;
  lastLoginAt?: string;
  createdAt: string;
}

// 审计日志
interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeData?: any;
  afterData?: any;
  isSensitive: number;
  remark?: string;
  ip: string;
  createdAt: string;
}

// 系统配置
interface SystemConfig {
  id: string;
  configKey: string;
  configValue: any;
  configType: 'payment' | 'sms' | 'business' | 'other' | 'agreement';
  description: string;
  isEncrypted: number;
}

// 仪表盘统计
interface DashboardStats {
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
  adoptionByType: Array<{ typeId: string; typeName: string; count: number; }>;
  pendingOrders: number;
  pendingRedemptions: number;
  exceptionAdoptions: number;
  pendingRefunds: number;
  userTotal: number;
  userToday: number;
  activeUsers: number;
}
```

---

## API接口规范

### 基础URL
```
前端API: /api
后台API: /api/admin
```

### 通用响应格式
```typescript
interface ApiResponse<T> {
  code: number;      // 状态码，0成功，非0失败
  message: string;   // 提示信息
  data: T;           // 业务数据
  timestamp: number; // 时间戳
}

interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### API路由列表

#### 用户端API

| 模块 | 方法 | 路由 | 说明 |
|------|------|------|------|
| **认证** | POST | /auth/sms/send | 发送短信验证码 |
| | POST | /auth/register | 用户注册 |
| | POST | /auth/login/password | 密码登录 |
| | POST | /auth/login/code | 验证码登录 |
| | GET | /auth/wechat/url | 获取微信授权URL |
| | GET | /auth/wechat/callback | 微信授权回调 |
| | POST | /auth/wechat/bind-phone | 绑定手机号 |
| | POST | /auth/password/reset | 重置密码 |
| **用户** | GET | /users/me | 获取当前用户信息 |
| | PUT | /users/me | 更新用户信息 |
| | GET | /users/agreements | 获取协议列表 |
| | GET | /users/agreements/:type | 获取协议内容 |
| **活体** | GET | /livestock/types | 获取活体类型列表 |
| | GET | /livestock | 获取活体列表 |
| | GET | /livestock/:id | 获取活体详情 |
| **订单** | POST | /orders/adoption | 创建领养订单 |
| | POST | /orders/adoption/:id/cancel | 取消订单 |
| | GET | /orders/adoption/:id | 获取订单详情 |
| | GET | /orders/adoption | 获取我的订单列表 |
| **领养** | GET | /adoptions | 获取我的领养列表 |
| | GET | /adoptions/:id | 获取领养详情 |
| | GET | /adoptions/:id/feed-bills | 获取饲料费账单列表 |
| **饲料费** | GET | /feed-bills/:id | 获取饲料费账单详情 |
| | POST | /feed-bills/:id/pay | 支付饲料费 |
| **买断** | POST | /redemptions/apply/:adoptionId | 申请买断 |
| | GET | /redemptions | 获取我的买断列表 |
| | GET | /redemptions/:id | 获取买断详情 |
| | POST | /redemptions/:id/pay | 支付买断 |
| **支付** | POST | /payments | 发起支付 |
| | GET | /payments/:paymentNo | 查询支付状态 |
| **余额** | GET | /balance | 获取余额 |
| | GET | /balance/logs | 获取余额流水 |
| **消息** | GET | /notifications | 获取站内信列表 |
| | GET | /notifications/unread-count | 获取未读消息数量 |
| | POST | /notifications/:id/read | 标记已读 |
| | POST | /notifications/read-all | 标记全部已读 |

#### 后台管理API

| 模块 | 方法 | 路由 | 说明 |
|------|------|------|------|
| **认证** | POST | /admin/auth/login | 管理员登录 |
| | GET | /admin/auth/info | 获取当前管理员信息 |
| | POST | /admin/auth/change-password | 修改密码 |
| **仪表盘** | GET | /admin/dashboard/stats | 获取统计数据 |
| | GET | /admin/dashboard/trend | 获取趋势数据 |
| **活体类型** | GET | /admin/livestock-types | 获取列表 |
| | POST | /admin/livestock-types | 创建类型 |
| | PUT | /admin/livestock-types/:id | 更新类型 |
| | DELETE | /admin/livestock-types/:id | 删除类型 |
| **活体** | GET | /admin/livestock | 获取列表 |
| | POST | /admin/livestock | 创建活体 |
| | PUT | /admin/livestock/:id | 更新活体 |
| | DELETE | /admin/livestock/:id | 删除活体 |
| | PUT | /admin/livestock/:id/status | 更新状态 |
| | PUT | /admin/livestock/:id/stock | 更新库存 |
| **订单** | GET | /admin/orders | 获取订单列表 |
| | GET | /admin/orders/:id | 获取订单详情 |
| **饲料费** | GET | /admin/feed-bills | 获取账单列表 |
| | PUT | /admin/feed-bills/:id/adjust | 调整金额 |
| | PUT | /admin/feed-bills/:id/waive | 豁免账单 |
| | PUT | /admin/feed-bills/:id/waive-late-fee | 豁免滞纳金 |
| **领养** | GET | /admin/adoptions/exception | 获取异常领养列表 |
| | PUT | /admin/adoptions/:id/resolve | 处理异常 |
| **买断** | GET | /admin/redemptions | 获取买断列表 |
| | GET | /admin/redemptions/:id | 获取买断详情 |
| | POST | /admin/redemptions/:id/audit | 审核买断 |
| **退款** | GET | /admin/refunds | 获取退款列表 |
| | GET | /admin/refunds/:id | 获取退款详情 |
| | PUT | /admin/refunds/:id/audit | 审核退款 |
| | POST | /admin/refunds/manual | 手动退款 |
| **用户** | GET | /admin/users | 获取用户列表 |
| | GET | /admin/users/:id | 获取用户详情 |
| | GET | /admin/users/:id/adoptions | 获取用户领养记录 |
| | GET | /admin/users/:id/orders | 获取用户订单 |
| | GET | /admin/users/:id/balance-logs | 获取用户余额流水 |
| | PUT | /admin/users/:id/status | 更新用户状态 |
| | PUT | /admin/users/:id | 更新用户信息 |
| | POST | /admin/users/:id/balance | 调整用户余额 |
| **消息** | GET | /admin/notifications | 获取消息列表 |
| | POST | /admin/notifications/send | 发送消息 |
| **系统配置** | GET | /admin/system-config | 获取配置列表 |
| | POST | /admin/system-config | 更新配置 |
| | POST | /admin/configs/test-payment/:type | 测试支付 |
| | POST | /admin/configs/test-sms | 测试短信 |
| **管理员** | GET | /admin/admins | 获取管理员列表 |
| | POST | /admin/admins | 创建管理员 |
| | PUT | /admin/admins/:id | 更新管理员 |
| | PUT | /admin/admins/:id/reset-password | 重置密码 |
| | PUT | /admin/admins/:id/status | 更新状态 |
| **审计日志** | GET | /admin/audit-logs | 获取日志列表 |
| | GET | /admin/audit-logs/:id | 获取日志详情 |
| **协议** | GET | /admin/agreements | 获取协议列表 |
| | GET | /admin/agreements/:key | 获取协议详情 |
| | POST | /admin/agreements | 保存协议 |
| | DELETE | /admin/agreements/:key | 删除协议 |

---

## 枚举值定义

### 状态码对照表

#### 用户状态 (UserStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | NORMAL | 正常 |
| 2 | RESTRICTED | 限制 |
| 3 | BANNED | 封禁 |

#### 管理员状态 (AdminStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | ENABLED | 启用 |
| 2 | DISABLED | 禁用 |

#### 管理员角色
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | super_admin | 超级管理员 |
| 2 | admin | 普通管理员 |

#### 活体状态 (LivestockStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | ON_SALE | 在售 |
| 2 | OFF_SALE | 下架 |

#### 订单状态 (OrderStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | PENDING_PAYMENT | 待支付 |
| 2 | PAID | 已支付 |
| 3 | CANCELLED | 已取消 |
| 4 | REFUNDED | 已退款 |

#### 领养状态 (AdoptionStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | ACTIVE | 领养中 |
| 2 | FEED_OVERDUE | 饲料费逾期 |
| 3 | EXCEPTION | 异常 |
| 4 | REDEEMABLE | 可买断 |
| 5 | REDEMPTION_PENDING | 买断审核中 |
| 6 | REDEEMED | 已买断 |
| 7 | TERMINATED | 已终止 |

#### 饲料费账单状态 (FeedBillStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | PENDING | 待支付 |
| 2 | PAID | 已支付 |
| 3 | OVERDUE | 已逾期 |
| 4 | WAIVED | 已免除 |

#### 买断类型 (RedemptionType)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | FULL | 满期买断 |
| 2 | EARLY | 提前买断 |

#### 买断状态 (RedemptionStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | PENDING_AUDIT | 待审核 |
| 2 | AUDIT_PASSED | 审核通过 |
| 3 | AUDIT_REJECTED | 审核拒绝 |
| 4 | PAID | 已支付 |
| 5 | CANCELLED | 已取消 |

#### 支付状态 (PaymentStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | PENDING | 待支付 |
| 2 | SUCCESS | 支付成功 |
| 3 | FAILED | 支付失败 |
| 4 | CLOSED | 已关闭 |

#### 退款类型 (RefundType)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | USER_APPLY | 用户申请 |
| 2 | ADMIN_OPERATE | 管理员操作 |
| 3 | SYSTEM_AUTO | 系统自动 |

#### 退款状态 (RefundStatus)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | PENDING_AUDIT | 待审核 |
| 2 | AUDIT_PASSED | 审核通过 |
| 3 | AUDIT_REJECTED | 审核拒绝 |
| 4 | REFUNDED | 已退款 |
| 5 | CANCELLED | 已取消 |

#### 余额变动类型 (BalanceLogType)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | RECHARGE | 充值 |
| 2 | CONSUME | 消费 |
| 3 | REFUND | 退款 |
| 4 | ADJUST | 调整 |

#### 通知类型 (NotificationType)
| 值 | 常量 | 说明 |
|----|------|------|
| 1 | SYSTEM | 系统通知 |
| 2 | ORDER | 订单通知 |
| 3 | FEED | 饲料费通知 |
| 4 | REDEMPTION | 买断通知 |
| 5 | BALANCE | 余额通知 |

#### 支付方式
| 值 | 说明 |
|----|------|
| alipay | 支付宝 |
| wechat | 微信支付 |
| balance | 余额支付 |

#### 订单类型
| 值 | 说明 |
|----|------|
| adoption | 领养订单 |
| feed | 饲料费 |
| redemption | 买断 |
| recharge | 充值 |

#### 短信验证码类型
| 值 | 说明 |
|----|------|
| register | 注册 |
| login | 登录 |
| reset_password | 重置密码 |

#### 系统配置类型
| 值 | 说明 |
|----|------|
| payment | 支付配置 |
| sms | 短信配置 |
| business | 业务配置 |
| other | 其他配置 |
| agreement | 协议内容 |

---

## 命名规则总览

### ID生成规则
| 实体 | 前缀 | 示例 |
|------|------|------|
| 用户 | U | U1712345678901ABCD |
| 管理员 | A | A1712345678901EFGH |
| 活体类型 | LT | LT1712345678901IJKL |
| 活体 | L | L1712345678901MNOP |
| 订单 | ORD | ORD1712345678901QRST |
| 领养记录 | ADP | ADP1712345678901UVWX |
| 饲料费账单 | FBL | FBL1712345678901YZAB |
| 买断订单 | RDM | RDM1712345678901CDEF |
| 支付记录 | PAY | PAY1712345678901GHIJ |
| 余额流水 | BL | BL1712345678901KLMN |
| 通知 | N | N1712345678901OPQR |
| 退款订单 | RFD | RFD1712345678901STUV |
| 系统配置 | SC | SC1712345678901WXYZ |
| 协议 | AG | AG1712345678901ABCD |

### 编号生成规则
| 实体 | 格式 | 示例 |
|------|------|------|
| 订单编号 | ORD + 年月日 + 6位随机 | ORD20260408ABC123 |
| 领养编号 | ADPT + 6位随机 | ADPTABC123 |
| 饲料费账单编号 | BILL + 年月 + 4位随机 | BILL2026041234 |
| 买断编号 | RDM + 6位随机 | RDMABC123 |
| 退款编号 | RFD + 6位随机 | RFDABC123 |
| 支付编号 | PAY + 年月日 + 8位随机 | PAY20260408ABCD1234 |

### 数据库命名规则
- 表名：小写字母 + 下划线，复数形式（snake_case）
- 字段名：小写字母 + 下划线（snake_case）
- 索引：单列索引直接在字段上添加 `@Index()`，复合索引使用 `@Index(['field1', 'field2'])`
- 外键：关联表名单数形式 + `_id`

### 后端命名规则
- 类名：大驼峰（PascalCase）
- 方法名：小驼峰（camelCase）
- 常量：全大写 + 下划线（UPPER_SNAKE_CASE）
- 文件名：小写字母 + 连字符（kebab-case）
- 模块文件夹：小写字母 + 连字符（kebab-case）

### 前端命名规则
- 组件名：大驼峰（PascalCase），如 `AdoptionDetailPage.tsx`
- 变量/函数名：小驼峰（camelCase）
- 常量：全大写 + 下划线（UPPER_SNAKE_CASE）
- CSS类名：使用 Tailwind CSS，自定义类名用小写字母 + 连字符
- 接口/类型名：大驼峰（PascalCase）

### API命名规则
- RESTful风格
- 路由使用小写字母 + 连字符（kebab-case）
- 路由参数使用小驼峰或直接使用ID
- 查询参数使用小驼峰（camelCase）

---

*文档版本: 1.0.0*
*最后更新: 2026-04-08*
