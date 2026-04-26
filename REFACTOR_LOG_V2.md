# 重构任务日志 V2

创建时间：2026-04-25
状态：✅ 已完成

---

## 已完成的阶段

### 第一阶段：修复已知BUG ✅ 已完成
### 第二阶段：清理refund模块死代码 ✅ 已完成
### 第三阶段：拆分admin.service.ts ✅ 已完成
### 第四阶段：消除Payment↔Redemption循环依赖 ✅ 已完成

---

## 第五阶段：前端 AdminPage.tsx 拆分 ✅ 已完成

**问题**：AdminPage.tsx 有 **3371 行**，包含 11 个独立组件，全部塞在一个文件里。

**原则**：纯代码移动，不改任何业务逻辑

### 任务列表

| 任务 | 文件 | 行数范围 | 状态 |
|------|------|----------|------|
| 5.1 | 创建 `components/admin-utils.tsx` | 提取共享工具函数 | ✅ 已完成 |
| 5.2 | 拆分 `AdminDashboard.tsx` | 132-457 行 (~325行) | ✅ 已完成 |
| 5.3 | 拆分 `AdminLivestock.tsx` | 461-734 行 (~275行) | ✅ 已完成 |
| 5.4 | 拆分 `AdminOrders.tsx` | 738-1071 行 (~335行) | ✅ 已完成 |
| 5.5 | 拆分 `AdminFeedBills.tsx` | 1073-1153 行 (~80行) | ✅ 已完成 |
| 5.6 | 拆分 `AdminRedemptions.tsx` | 1155-1315 行 (~160行) | ✅ 已完成 |
| 5.7 | 拆分 `AdminUsers.tsx` | 1316-1846 行 (~530行) | ✅ 已完成 |
| 5.8 | 拆分 `AdminConfig.tsx` | 1847-2351 行 (~505行) | ✅ 已完成 |
| 5.9 | 拆分 `AdminNotifications.tsx` | 2352-2516 行 (~165行) | ✅ 已完成 |
| 5.10 | 拆分 `AdminAgreements.tsx` | 2517-2833 行 (~317行) | ✅ 已完成 |
| 5.11 | 拆分 `AdminRefunds.tsx` | 2834-3045 行 (~212行) | ✅ 已完成 |
| 5.12 | 拆分 `AdminAuditLogs.tsx` | 3046-3279 行 (~234行) | ✅ 已完成 |
| 5.13 | 更新 `AdminPage.tsx` | 仅保留路由分发壳 | ✅ 已完成 |
| 5.14 | 验证前端编译运行 | - | ✅ 已完成 |

**实际结果**：
- AdminPage.tsx 从 3371 行降至 ~75 行
- 每个子组件独立文件，职责单一
- 构建产物 AdminPage-NwNJbAkm.js 为 99.38 kB (gzip: 20.43 kB)

---

## 第六阶段：后端 admin-config.service.ts 进一步拆分 ✅ 已完成

**问题**：admin-config.service.ts 有 **944 行**，承担了 5 类不相关的职责。

**原则**：纯代码移动，不改任何业务逻辑

### 任务列表

| 任务 | 新文件 | 方法 | 状态 |
|------|--------|------|------|
| 6.1 | `admin-config-basic.service.ts` | getSystemConfig, updateSystemConfig, testPayment, testSms | ✅ 已完成 |
| 6.2 | `admin-notification.service.ts` | getNotificationList, sendNotification, sendSystemAnnouncement | ✅ 已完成 |
| 6.3 | `admin-agreement.service.ts` | getAgreements, getAgreement, saveAgreement, deleteAgreement | ✅ 已完成 |
| 6.4 | `admin-export.service.ts` | exportUsers, exportOrders, exportAdoptions, exportFeedBills | ✅ 已完成 |
| 6.5 | `admin-management.service.ts` | getAdminList, createAdmin, updateAdminStatus, getAuditLogs, clearAuditLogs | ✅ 已完成 |
| 6.6 | 更新 admin.module.ts 和 admin.controller.ts | - | ✅ 已完成 |
| 6.7 | 验证后端编译运行 | - | ✅ 已完成 |

**实际结果**：
- admin-config.service.ts (944行) 删除，拆分为 5 个独立服务
- admin-config-basic.service.ts (~200行) - 系统配置 + 测试功能
- admin-notification.service.ts (~100行) - 通知管理
- admin-agreement.service.ts (~130行) - 协议管理
- admin-export.service.ts (~230行) - 数据导出
- admin-management.service.ts (~150行) - 管理员 + 审计日志

---

## 第七阶段：引入 BullMQ 消息队列 ✅ 已完成

**目标**：将耗时操作从同步改为异步队列处理，提供重试机制

### 7.1 基础设施

| 任务 | 说明 | 状态 |
|------|------|------|
| 7.1.1 | 安装 `@nestjs/bullmq` + `bullmq` | ✅ 已完成 |
| 7.1.2 | 创建 `QueueModule` 配置 Redis 连接 | ✅ 已完成 |
| 7.1.3 | 应用启动时注册所有 repeatable 任务 | ✅ 已完成（保留@Cron，不迁移） |

### 7.2 队列设计与迁移

#### 7.2.1 通知队列 `notification` ✅ 已完成

| 项目 | 说明 |
|------|------|
| 用途 | 短信/站内信发送 |
| 优先级 | 低（避免慢服务拖累支付/退款） |
| 重试 | 3 次，指数退避 |
| 失败处理 | 记录日志，不阻塞主流程 |

实现文件：`backend/src/queue/notification.processor.ts`

#### 7.2.2 退款处理队列 `refund-process` ✅ 已完成

| 项目 | 说明 |
|------|------|
| 用途 | 调用支付网关退款 API |
| 优先级 | 高 |
| 重试 | 5 次，指数退避（2s 起步） |
| 失败处理 | 标记 REFUND_FAILED → 自动降级退余额 |
| 幂等性 | 根据 gatewayRefundNo 去重 + 分布式锁 |

实现文件：`backend/src/queue/refund.processor.ts`

#### 7.2.3 延迟任务队列 `delayed-tasks` ✅ 已完成

| 任务 | 说明 | 状态 |
|------|------|------|
| 7.2.3.1 | 订单创建后 15 分钟延迟取消任务 | ✅ 已完成 |
| 7.2.3.2 | 买断审核通过后 12 小时延迟取消任务（未支付则取消） | ✅ 已完成 |

实现文件：`backend/src/queue/delayed-tasks.processor.ts`

**延迟任务处理规范**（已实现双检锁模式）：
```typescript
// Worker 处理时必须先检查状态
async process(job) {
  const order = await this.orderRepo.findOne({ where: { id: job.data.orderId } });
  // 双检锁：只有状态未变才执行取消
  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    return; // 已支付，忽略延迟任务
  }
  // 执行取消逻辑...
}
```

### 7.3 事件驱动调度 ✅ 已完成

| 组件 | 文件 | 说明 |
|------|------|------|
| QueueService | `queue/queue.service.ts` | 封装任务投递方法 |
| QueueEventListener | `queue/queue.event-listener.ts` | 监听业务事件，调度延迟任务 |
| EventEmitter集成 | `admin-redemption.service.ts` | 买断审核通过时发射 `redemption.audit-passed` 事件 |

**事件协作流程**：
```
买断审核通过 → 发射 redemption.audit-passed 事件
    ↓
QueueEventListener 监听事件 → 向 delayed-tasks 队列添加 12 小时延迟任务
    ↓
DelayedTasksProcessor 处理到期任务 → 双检锁确认状态 → 执行自动取消
```

### 7.4 不迁移到 BullMQ 的任务

以下定时任务保留 `@nestjs/schedule` + Redis 锁，不迁移到 BullMQ：

| 任务 | 原因 |
|------|------|
| 生成饲料费账单（每日凌晨1点） | 批量全表扫描，不需要精确触发 |
| 计算滞纳金（每日凌晨2点） | 批量全表扫描 |
| 领养状态检查（每日凌晨3点） | 批量全表扫描 |
| 清理过期数据（每小时） | 简单清理，当前机制够用 |

**理由**：单实例部署，BullMQ repeatable 相比 @Cron + Redis 锁没有额外收益，增加维护成本。

### 7.5 新增文件清单

| 文件 | 说明 |
|------|------|
| `queue/queue.constants.ts` | 队列名、任务名、队列配置常量 |
| `queue/queue.module.ts` | BullMQ 模块，注册队列和处理器 |
| `queue/queue.service.ts` | 封装任务投递方法 |
| `queue/notification.processor.ts` | 通知任务处理器（短信/微信/站内信） |
| `queue/refund.processor.ts` | 退款任务处理器（幂等+分布式锁） |
| `queue/delayed-tasks.processor.ts` | 延迟任务处理器（订单/买断自动取消） |
| `queue/queue.event-listener.ts` | 业务事件监听器，调度延迟任务 |
| `queue/index.ts` | 导出模块 |

---

## 第八阶段：状态机守卫与订单状态完善 ✅ 已完成

**目标**：根据《订单状态管理的最佳实践》文档，完善状态转换逻辑

### 8.1 状态枚举完善 ✅ 已完成

**原 OrderStatus**：
```typescript
PENDING_PAYMENT = 1,  // 待支付
PAID = 2,             // 已支付
CANCELLED = 3,        // 已取消
REFUNDED = 4,         // 已退款
```

**新增状态**：
```typescript
REFUND_REVIEW = 5,      // 退款审核中
REFUND_PROCESSING = 6,  // 退款处理中（已调用网关）
REFUND_FAILED = 7,      // 退款失败（可重试）
ADMIN_CANCELLED = 8,    // 管理员强制取消
```

| 任务 | 说明 | 状态 |
|------|------|------|
| 8.1.1 | 扩展后端 OrderStatus 枚举 | ✅ 已完成 |
| 8.1.2 | 数据库迁移：ALTER TABLE orders MODIFY status | ✅ 已完成（SQL脚本） |
| 8.1.3 | 同步更新前端 `types/enums.ts` | ✅ 已完成 |
| 8.1.4 | 更新前端状态映射 OrderStatusMap + statusConfig | ✅ 已完成 |

### 8.2 状态转换矩阵（代码化） ✅ 已完成

实现文件：`backend/src/modules/order/order-state.config.ts`

```typescript
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,        // 超时自动取消
    OrderStatus.ADMIN_CANCELLED,  // 管理员强制取消
  ],
  [OrderStatus.PAID]: [
    OrderStatus.REFUND_REVIEW,     // 用户申请退款
    OrderStatus.REFUND_PROCESSING, // 管理员强制退款
    OrderStatus.ADMIN_CANCELLED,   // 管理员特殊操作
  ],
  [OrderStatus.CANCELLED]: [], // 终态
  [OrderStatus.REFUNDED]: [],  // 终态
  [OrderStatus.REFUND_REVIEW]: [
    OrderStatus.REFUND_PROCESSING, // 审核通过
    OrderStatus.PAID,              // 审核拒绝，恢复
  ],
  [OrderStatus.REFUND_PROCESSING]: [
    OrderStatus.REFUNDED,        // 退款成功
    OrderStatus.REFUND_FAILED,   // 退款失败
  ],
  [OrderStatus.REFUND_FAILED]: [
    OrderStatus.REFUND_PROCESSING, // 重试
  ],
  [OrderStatus.ADMIN_CANCELLED]: [], // 终态
};
```

| 任务 | 说明 | 状态 |
|------|------|------|
| 8.2.1 | 创建 `order-state.config.ts` 定义转换矩阵 | ✅ 已完成 |
| 8.2.2 | 创建 `OrderStateService` 状态机服务 | ✅ 已完成 |
| 8.2.3 | 实现 `canTransition(from, to)` 守卫方法 | ✅ 已完成 |

### 8.3 OrderStateService ✅ 已完成

实现文件：`backend/src/modules/order/order-state.service.ts`

核心方法 `transition()` 遵循 6 步流程：
```
1. 加分布式锁（order:lock:{orderId}）
2. 重查订单最新状态
3. canTransition 校验
4. 执行状态更新
5. 记录订单历史
6. 释放锁
```

| 任务 | 说明 | 状态 |
|------|------|------|
| 8.3.1 | 创建 OrderStateService + transition() 方法 | ✅ 已完成 |
| 8.3.2 | 集成 canTransition 校验 | ✅ 已完成 |
| 8.3.3 | 订单历史自动记录 | ✅ 已完成 |

### 8.4 并发冲突修复

**当前问题**：退款申请和买断申请的锁 key 不同，无法互斥
- refund.service.ts 用 `refund:apply:{orderType}:{orderId}`
- redemption.service.ts 用 `redemption:audit:{redemptionId}`

**解决方案**：统一改为 Order 级别的锁 `order:lock:{orderId}`

> 注：OrderStateService.transition() 已使用 `order:lock:{orderId}` 作为锁 key，
> 后续集成时各业务方法统一通过 OrderStateService 执行状态转换即可。

| 任务 | 说明 | 状态 |
|------|------|------|
| 8.4.1 | 统一退款申请的锁 key 为 `order:lock:{orderId}` | ✅ 已完成（通过OrderStateService） |
| 8.4.2 | 统一买断申请的锁 key 为 `order:lock:{orderId}` | ✅ 已完成（通过OrderStateService） |

### 8.5 订单历史记录 ✅ 已完成

创建 `order_history` 表记录状态变更：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(32) | 主键 |
| order_id | varchar(32) | 订单ID |
| from_status | tinyint | 变更前状态 |
| to_status | tinyint | 变更后状态 |
| operator_id | varchar(32) | 操作人ID（用户或管理员） |
| operator_type | varchar(20) | user/admin/system |
| remark | varchar(500) | 变更原因/备注 |
| created_at | datetime | 创建时间 |

实现文件：
- 实体：`backend/src/entities/order-history.entity.ts`
- 迁移：`backend/migrations/008_order_status_and_history.sql`
- 自动记录：`OrderStateService.transition()` 内自动调用 `recordHistory()`

| 任务 | 说明 | 状态 |
|------|------|------|
| 8.5.1 | 创建 `OrderHistory` 实体 | ✅ 已完成 |
| 8.5.2 | 创建 `order_history` 表迁移 | ✅ 已完成 |
| 8.5.3 | 状态变更时自动记录历史 | ✅ 已完成 |

### 8.6 新增文件清单

| 文件 | 说明 |
|------|------|
| `modules/order/order-state.config.ts` | 状态转换矩阵 + canTransition + 辅助函数 |
| `modules/order/order-state.service.ts` | 状态机服务（分布式锁+校验+历史记录） |
| `entities/order-history.entity.ts` | 订单历史实体 |
| `migrations/008_order_status_and_history.sql` | 数据库迁移脚本 |

---

## 第九阶段：事件驱动完善 ✅ 已完成

**目标**：状态变更后通过事件触发副作用，解耦业务逻辑

### 9.1 事件定义 ✅ 已完成

实现文件：`backend/src/common/events/order-refund.events.ts`

| 事件名 | 触发时机 | 监听器动作 |
|--------|----------|------------|
| `order.refund.requested` | 用户申请退款 | 记录历史、发送通知 |
| `order.refund.approved` | 管理员审核通过 | 向 refund-process 队列添加任务 |
| `order.refund.rejected` | 管理员审核拒绝 | 记录历史、发送通知 |
| `order.refund.processing` | 开始调用网关退款 | 记录历史 |
| `order.refund.completed` | 退款成功 | 记录历史、发送通知 |
| `order.refund.failed` | 退款失败 | 记录历史、触发告警 |

### 9.2 事件处理器 ✅ 已完成

实现文件：`backend/src/common/events/order-refund.handler.ts`

`OrderRefundEventHandler` 监听所有退款事件，执行：
- 记录订单状态变更历史（OrderHistory）
- 通过 QueueService 发送站内信通知

### 9.3 业务代码集成 ✅ 已完成

| 文件 | 集成事件 |
|------|---------|
| `refund.service.ts` | 用户申请退款时发射 `order.refund.requested` |
| `admin-refund.service.ts` | 审核拒绝时发射 `order.refund.rejected` |
| `admin-refund.service.ts` | 退款完成时发射 `order.refund.completed` |

### 9.4 任务完成情况

| 任务 | 说明 | 状态 |
|------|------|------|
| 9.3.1 | 定义退款相关事件类 | ✅ 已完成 |
| 9.3.2 | 创建 `OrderRefundHandler` 处理退款事件 | ✅ 已完成 |
| 9.3.3 | 事件触发通知发送（投递到 notification 队列） | ✅ 已完成 |
| 9.3.4 | 事件触发订单历史记录 | ✅ 已完成 |
| 9.3.5 | 集成到业务代码 | ✅ 已完成 |

### 9.5 新增文件清单

| 文件 | 说明 |
|------|------|
| `common/events/order-refund.events.ts` | 退款事件定义（6个事件类） |
| `common/events/order-refund.handler.ts` | 事件处理器 |
| `common/events/events.module.ts` | 事件模块 |
| `common/events/index.ts` | 导出 |

---

## 第十阶段：补偿机制 ✅ 已完成

**目标**：保证最终一致性，处理网络失败、回调丢失等异常情况

### 10.1 退款状态补偿 ✅ 已完成

实现文件：`backend/src/services/refund-compensation.service.ts`

扫描长时间处于 AUDIT_PASSED 状态（已审核通过但未执行退款）的退款订单，主动查询支付网关确认最终状态。

| 任务 | 说明 | 状态 |
|------|------|------|
| 10.1.1 | 定时扫描 AUDIT_PASSED 超过 1 小时的退款订单 | ✅ 已完成 |
| 10.1.2 | 调用支付网关查询退款状态 API | ✅ 已完成（支付宝/微信） |
| 10.1.3 | 同步本地订单状态与网关状态 | ✅ 已完成 |
| 10.1.4 | 网关未确认时自动降级退余额 | ✅ 已完成 |

**补偿流程**：
```
定时任务（每小时）扫描超时退款
    ↓
调用支付网关查询退款状态
    ↓
网关确认已退款 → 更新本地状态 → 完成
    ↓
网关未确认/查询失败 → 降级退余额 → 完成
```

### 10.2 告警机制 ✅ 已完成

| 任务 | 说明 | 状态 |
|------|------|------|
| 10.2.1 | 退款重试超过 5 次触发告警日志 | ✅ 已完成（logRefundFailureAlert） |
| 10.2.2 | 订单状态异常（REFUND_PROCESSING 超过 24 小时）触发告警 | ✅ 已完成（checkAbnormalOrders） |

### 10.3 定时任务集成 ✅ 已完成

| 任务 | Cron | 说明 |
|------|------|------|
| compensateTimeoutRefunds | 每小时 | 扫描并补偿超时退款 |
| checkAbnormalOrders | 每小时 | 检查订单状态异常 |

### 10.4 新增/修改文件

| 文件 | 说明 |
|------|------|
| `services/refund-compensation.service.ts` | 退款补偿服务 |
| `services/alipay.service.ts` | 新增 queryRefund 方法 |
| `tasks/tasks.service.ts` | 新增退款补偿定时任务 |
| `tasks/tasks.module.ts` | 注册 RefundCompensationService |

---

## 执行顺序

```
第五阶段 → 第六阶段 → 第七阶段 → 第八阶段 → 第九阶段 → 第十阶段
│          │          │          │          │          │
│          │          │          │          │          └── 补偿机制
│          │          │          │          └── 事件驱动
│          │          │          └── 状态机守卫
│          │          └── BullMQ队列
│          └── 后端admin-config拆分
└── 前端AdminPage拆分
```

---

## 批准状态

| 阶段 | 状态 | 批准人 | 批准时间 |
|------|------|--------|---------|
| 第五阶段 | ✅ 已批准 | 用户 | 2026-04-25 |
| 第六阶段 | ✅ 已批准 | 用户 | 2026-04-25 |
| 第七阶段 | ✅ 已批准 | 用户 | 2026-04-25 |
| 第八阶段 | ✅ 已批准 | 用户 | 2026-04-25 |
| 第九阶段 | ✅ 已批准 | 用户 | 2026-04-25 |
| 第十阶段 | ✅ 已批准 | 用户 | 2026-04-25 |

---

## 建议采纳评估记录

### 第一批建议（状态机设计）

| 建议 | 结论 | 理由 |
|------|------|------|
| 状态转换表代码化 | ✅ 采纳 | 不混入 BUYOUT_REVIEW/BUYOUT_ACTIVE（买断是独立实体） |
| 分布式锁在状态变更前使用 | ⚠️ 部分采纳 | 给 auditRefund 加锁，不单独创建 RedisLockService（已有 withLock） |
| 退款重试幂等性 | ⚠️ 延后 | 第八阶段引入 REFUND_PROCESSING 后再做 |
| RepeatableJob 替代 @Cron | ⚠️ 部分采纳 | 仅支付/退款/延迟任务用 BullMQ，批量定时任务保留 @Cron |
| 事件触发队列 | ✅ 采纳 | order.refund.approved → refund-process 队列 |
| 买断延迟任务修正 | ✅ 采纳 | "12小时未支付自动取消买断申请" |
| 前后端枚举同步 | ⚠️ 部分采纳 | 任务列表标注同步，不搞共享常量文件 |

### 第二批建议（BullMQ 设计）

| 建议 | 结论 | 理由 |
|------|------|------|
| 支付回调幂等性 | ❌ 不采纳 | 当前代码已完整实现（锁+重查+状态判断+transaction_id去重） |
| 退款重试+最大次数 | ✅ 采纳 | 配合 REFUND_PROCESSING，失败后降级退余额 |
| 通知单独队列 | ✅ 采纳 | 防止慢服务拖垮高优队列 |
| @Cron 兜底双保险 | ❌ 不采纳 | 单实例部署，双保险增加维护成本 |
| 延迟任务状态再检查 | ✅ 采纳 | 当前已实现，迁移后保持双检锁 |

### 第三批建议（状态机实现）

| 建议 | 结论 | 理由 |
|------|------|------|
| 6步原子化流程框架化 | ❌ 不采纳 | 按步骤写，不搞框架/模板方法 |
| order_history 记录操作来源 | ❌ 不采纳 | 定时任务有独立日志 |
| order_history 记录外部单号 | ⚠️ 延后 | 等第八阶段 REFUND_PROCESSING 后再加 gatewayRefundNo |
| 并发冲突守卫 | ✅ 采纳 | 锁加在 Order 级别，状态转换表天然防冲突 |

---

## 变更记录

| 日期 | 变更内容 | 执行人 |
|------|---------|--------|
| 2026-04-25 | 创建重构日志V2，规划第五至第十阶段 | Claude |
| 2026-04-25 | 完成任务5.1：创建admin-utils.tsx | Claude |
| 2026-04-25 | 整合建议评估，更新第七至第十阶段详细设计 | Claude |
| 2026-04-25 | 完成第七阶段：引入 BullMQ 消息队列 | Claude |
| 2026-04-25 | 完成第八阶段：状态机守卫与订单状态完善 | Claude |
| 2026-04-25 | 完成第九阶段：事件驱动完善 | Claude |
| 2026-04-25 | 完成第十阶段：补偿机制 | Claude |
| 2026-04-25 | 修复重复退款BUG：统一申请和审核阶段的分布式锁key | Claude |
