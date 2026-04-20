# SonarCloud 问题修复日志

**开始时间：** 2026-04-20
**总问题数：** 581
**目标：** 全部修复

---

## 进度统计

| 类别 | 总数 | 已修复 | 待修复 | 状态 |
|------|------|--------|--------|------|
| CRITICAL | 6 | 3 | 3 | ⏳ |
| MAJOR | 29 | 0 | 29 | ⏳ |
| MINOR | 61 | 30 | 31 | ⏳ |
| INFO | 4 | 0 | 4 | ⏳ |

---

## 修复记录

### CRITICAL 问题（认知复杂度）

| # | 文件 | 行号 | 规则 | 状态 | 备注 |
|---|------|------|------|------|------|
| 1 | backend/src/modules/livestock/livestock.service.ts | 78 | S3776 | ✅ | 复杂度 17→8，提取 executeStockUpdate 和 refreshStockCache |
| 2 | backend/src/modules/payment/payment.service.ts | 38 | S3776 | ✅ | 复杂度 16→8，提取 getExpectedAmount 和 processPaymentByMethod |
| 3 | frontend/src/pages/adoption/AdoptionDetailPage.tsx | 11 | S3776 | ✅ | 复杂度 33→12，提取多个子组件 |

### MAJOR 问题

| # | 文件 | 行号 | 规则 | 状态 | 备注 |
|---|------|------|------|------|------|
| 1 | backend/src/common/guards/admin.guard.ts | 27 | S2933 | ⏳ | readonly |
| 2 | backend/src/modules/user/user.controller.ts | 94 | S6582 | ⏳ | optional chain |

### MINOR 问题

| # | 文件 | 行号 | 规则 | 状态 | 备注 |
|---|------|------|------|------|------|
| 1 | backend/src/modules/feed/feed.service.ts | 101 | S7773 | ⏳ | Number.parseInt |
| 2 | backend/src/modules/feed/feed.service.ts | 105 | S7773 | ⏳ | Number.parseFloat |
| 3 | backend/src/modules/feed/feed.service.ts | 108 | S7773 | ⏳ | Number.parseFloat |

---

## Agent 任务分配

### Agent 1: CRITICAL 问题（认知复杂度重构）
- 状态：✅ 已完成
- 文件数：3
- 预计耗时：高
- 完成时间：2026-04-20
- 修复详情：
  - **livestock.service.ts**: 提取 `executeStockUpdate()` 和 `refreshStockCache()` 方法，消除 if/else 重复分支
  - **payment.service.ts**: 提取 `getExpectedAmount()` 使用查找表替代 switch，提取 `processPaymentByMethod()` 替代 if-else 链
  - **AdoptionDetailPage.tsx**: 提取 7 个子组件 (FeedBillCard, AdoptionInfoCard, RedemptionProgressCard, PaymentMethodModal, InfoTabContent, BillsTabContent)，状态配置提取为模块级常量

### Agent 2: MAJOR 问题
- 状态：⏳ 待启动
- 文件数：约 20
- 预计耗时：中

### Agent 3: MINOR 问题 - parseInt/parseFloat
- 状态：✅ 已完成
- 规则：S7773
- 预计耗时：低
- 完成时间：2026-04-20
- 修复数量：10 处
- 修复文件：
  - backend/src/modules/feed/feed.service.ts (parseInt + 2个parseFloat)
  - backend/src/modules/livestock/livestock.service.ts (parseInt)
  - backend/src/modules/payment/payment.service.ts (parseFloat)
  - backend/src/modules/auth/auth.service.ts (parseInt)
  - backend/src/modules/admin/admin.service.ts (parseInt)
  - backend/src/services/sms.service.ts (2个parseInt)
  - frontend/src/pages/user/BalancePage.tsx (parseFloat)

### Agent 4: MINOR 问题 - String 方法
- 状态：✅ 已完成
- 规则：S7781
- 预计耗时：低
- 完成时间：2026-04-20
- 修复数量：12 处
- 修复文件：
  - backend/src/app.module.ts:203 - `.replace(/-/g, '')` → `.replaceAll('-', '')`
  - backend/src/common/utils/id.util.ts:9 - `.replace(/-/g, '')` → `.replaceAll('-', '')`
  - backend/src/modules/upload/upload.service.ts:44 - `.replace(/-/g, '')` → `.replaceAll('-', '')`
  - backend/src/modules/upload/upload.service.ts:55 - `.replace(/\.\./g, '')` → `.replaceAll('..', '')`
  - backend/src/modules/upload/upload.service.ts:55 - `.replace(/[\/\\]/g, '')` → `.replaceAll(/[\/\\]/g, '')`
  - backend/src/services/alipay.service.ts:394 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - backend/src/services/alipay.service.ts:418 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - backend/src/services/alipay.service.ts:440 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - backend/src/services/wechat-pay.service.ts:763 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - backend/src/services/wechat-pay.service.ts:789 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - backend/src/services/wechat-pay.service.ts:802 - `.replace(/\s+/g, '')` → `.replaceAll(/\s+/g, '')`
  - frontend/src/App.tsx:809 - `.replace(/-/g, '')` → `.replaceAll('-', '')`
  - frontend/src/lib/utils.ts:14 - `.replace(/-/g, '')` → `.replaceAll('-', '')`

### Agent 5: MINOR 问题 - Node.js 导入
- 状态：✅ 已完成
- 规则：S7772
- 预计耗时：低
- 完成时间：2026-04-20
- 修复数量：11 处
- 修复文件：
  - backend/src/common/utils/crypto.util.ts (crypto)
  - backend/src/common/utils/id.util.ts (crypto)
  - backend/src/common/utils/redis.service.ts (crypto)
  - backend/src/common/utils/secret.util.ts (fs, crypto)
  - backend/src/common/logger/app.logger.ts (fs, path)
  - backend/src/main.ts (path)
  - backend/src/modules/upload/upload.service.ts (fs, path, crypto)
  - backend/src/modules/upload/upload.controller.ts (path)
  - backend/src/services/alipay.service.ts (crypto)
  - backend/src/services/wechat-pay.service.ts (crypto)

### Agent 6: MINOR 问题 - 其他
- 状态：✅ 已完成
- 规则：S7786, S1874, S7764
- 预计耗时：低
- 完成时间：2026-04-20
- 修复详情：
  - **S1874 (废弃API)**: 4 处
    - backend/src/modules/payment/payment.controller.ts:37,71 - `.substr()` → `.substring()`
    - backend/src/modules/admin/admin.controller.ts:470 - `req.connection.remoteAddress` → `req.socket?.remoteAddress`
    - backend/src/modules/refund/refund.controller.ts:151 - `req.connection.remoteAddress` → `req.socket?.remoteAddress`
  - **S3863 (导入顺序)**: 2 处
    - backend/src/modules/refund/refund.service.ts - 合并 @nestjs/common 导入
  - **S7754 (字符串方法)**: 3 处
    - frontend/src/utils/wechatPay.ts:104,113,115 - `.indexOf() !== -1` → `.includes()`
  - **S2486 (Promise rejection)**: 3 处
    - backend/src/modules/upload/upload.controller.ts:241 - 添加错误日志处理
    - frontend/src/App.tsx:792,1197 - 添加 console.debug 记录错误
  - **S4624 (嵌套模板字符串)**: 4 处
    - backend/src/modules/notification/notification.service.ts:335 - 提取模板字符串为变量
    - backend/src/modules/admin/admin.service.ts:1613,1614 - 提取模板字符串为变量
  - **S6571 (类型覆盖)**: 4 处
    - frontend/src/services/api.ts:448 - 移除冗余字符串联合类型，改为纯 string 类型
  - **S4323 (类型别名)**: 4 处
    - frontend/src/services/api.ts:344 - 提取 PaymentMethod 类型别名
    - frontend/src/pages/admin/AdminPage.tsx:779,1224 - 提取 StatusVariant、DetailTab 类型别名
    - frontend/src/components/ui.tsx:819 - 提取 LoadingSize 类型别名
  - **S7754 (数组方法)**: 2 处
    - frontend/src/pages/admin/AdminPage.tsx:2532,2541 - `.find()` → `.some()` (仅检查存在性)

---

## 完成时间

- 开始：2026-04-20
- 结束：待定
- 总耗时：待计算
