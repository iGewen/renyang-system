# 云端牧场项目 - 命名不一致问题汇总

## 一、ID前缀不一致问题

### 问题详情
文档中定义的ID前缀与实际代码中使用的ID前缀存在不一致：

| 实体 | 文档定义前缀 | 实际代码前缀 | 文件位置 |
|------|-------------|-------------|----------|
| 用户 | U | U | auth.service.ts |
| 管理员 | A | A | admin.service.ts |
| 活体类型 | LT | LT | admin.service.ts |
| 活体 | L | L | admin.service.ts |
| 订单 | O | ORD | order.service.ts |
| 领养记录 | ADPT | ADP | order.service.ts |
| 饲料费账单 | FB | FBL | feed.service.ts |
| 买断订单 | RDM | RDM | redemption.service.ts |
| 支付记录 | PAY | PAY | payment.service.ts |
| 余额流水 | BL | BL | admin.service.ts |
| 退款订单 | RF | RFD | refund.service.ts |

### 需要修正的文档
更新 `FIELD_NAMING_CONVENTIONS.md` 中ID生成规则表：
- 订单：前缀应为 `ORD`（非 `O`）
- 领养记录：前缀应为 `ADP`（非 `ADPT`）
- 饲料费账单：前缀应为 `FBL`（非 `FB`）
- 退款订单：前缀应为 `RFD`（非 `RF`）

---

## 二、编号生成规则不一致

### 问题描述
`IdUtil` 类中生成编号的方法与文档定义不完全一致：

| 实体 | 文档定义格式 | 实际代码格式 | 文件位置 |
|------|-------------|-------------|----------|
| 订单编号 | ORD + 时间戳 + 随机数 | ORD + 年月日 + 随机数 | id.util.ts:generateOrderNo() |
| 领养编号 | ADPT + 时间戳 + 随机数 | ADPT + 随机数(6位) | id.util.ts:generateAdoptionNo() |
| 饲料费账单 | FB + 年月 + 随机数 | BILL + 年月 + 随机数(4位) | id.util.ts:generateBillNo() |
| 买断编号 | RDM + 时间戳 + 随机数 | RDM + 随机数(6位) | id.util.ts:generateRedemptionNo() |
| 退款编号 | RF + 时间戳 + 随机数 | RFD + 随机数(6位) | id.util.ts:generateRefundNo() |

### 需要修正
更新文档中编号生成规则表，使其与实际代码一致。

---

## 三、前端类型定义与后端不一致

### 1. RedemptionOrder.type 字段
**后端定义（redemption-order.entity.ts）：**
```typescript
type: number; // 1=满期买断 2=提前买断
```

**前端定义（types/index.ts）：**
```typescript
type: 'full' | 'early'; // 字符串类型
```

**问题：** 类型不一致，后端使用数字枚举，前端使用字符串字面量。

**建议：** 统一使用数字枚举，前端应改为：
```typescript
type: number; // 1=满期买断 2=提前买断
```

### 2. RedemptionOrder 字段命名
**后端实体字段：** `auditRemark` (驼峰)
**前端使用：** `auditRemark` (驼峰) ✓ 一致

### 3. FeedBill 的 livestock 关联
**后端查询：** `relations: ['livestock', 'adoption']`
**前端类型：** `livestock?: Livestock;` ✓ 一致

---

## 四、API路径命名不一致

### 后端Controller路径 vs 前端API调用

| 功能 | 后端路径 | 前端调用路径 | 是否一致 |
|------|---------|-------------|----------|
| 用户信息 | GET /users/me | /users/me | ✓ |
| 协议列表 | GET /users/agreements | /users/agreements | ✓ |
| 协议详情 | GET /users/agreements/:type | /users/agreements/:type | ✓ |
| 饲料费账单详情 | GET /adoptions/feed-bills/:billId | /feed-bills/:billId | ❌ 不一致 |
| 支付饲料费 | POST /adoptions/feed-bills/:billId/pay | /feed-bills/:billId/pay | ❌ 不一致 |

### 问题分析
后端在 `adoption.controller.ts` 中定义了：
```typescript
@Get('feed-bills/:billId')
@Post('feed-bills/:billId/pay')
```
这些路由实际上是 `/adoptions/feed-bills/:billId`，因为Controller路径是 `adoptions`。

但前端API调用使用的是 `/feed-bills/:billId`，这会导致404错误。

**解决方案：**
1. 创建独立的 `feed-bills.controller.ts`，路由为 `feed-bills`
2. 或修改前端API路径为 `/adoptions/feed-bills/:billId`

---

## 五、字段命名风格不一致

### 数据库字段 vs 实体属性

| 数据库字段 | 实体属性 | 是否一致 |
|-----------|---------|----------|
| user_id | userId | ✓ (自动转换) |
| order_id | orderId | ✓ (自动转换) |
| livestock_id | livestockId | ✓ (自动转换) |
| adoption_id | adoptionId | ✓ (自动转换) |
| feed_months_paid | feedMonthsPaid | ✓ (自动转换) |
| late_fee_amount | lateFeeAmount | ✓ (自动转换) |
| is_exception | isException | ✓ (自动转换) |
| paid_at | paidAt | ✓ (自动转换) |
| created_at | createdAt | ✓ (自动转换) |
| updated_at | updatedAt | ✓ (自动转换) |

**结论：** TypeORM自动处理snake_case到camelCase的转换，无需修改。

---

## 六、状态枚举值一致性

### 后端枚举定义位置
所有枚举定义在 `backend/src/entities/*.entity.ts` 文件中：
- `OrderStatus` - order.entity.ts
- `AdoptionStatus` - adoption.entity.ts
- `FeedBillStatus` - feed-bill.entity.ts
- `RedemptionType` - redemption-order.entity.ts
- `RedemptionStatus` - redemption-order.entity.ts
- `PaymentStatus` - payment-record.entity.ts
- `RefundType` - refund-order.entity.ts
- `RefundStatus` - refund-order.entity.ts
- `UserStatus` - 需要定义（目前使用数字）
- `LivestockStatus` - 需要定义（目前使用数字）

### 前端枚举定义
`frontend/src/types/enums.ts` - 与后端一致 ✓

---

## 七、缺失的枚举定义

### 后端缺失
以下枚举在实体中使用数字但没有明确定义：

1. **UserStatus** - 用户状态
   ```typescript
   // 应该定义在 user.entity.ts
   export enum UserStatus {
     NORMAL = 1,      // 正常
     RESTRICTED = 2,  // 限制
     BANNED = 3,      // 封禁
   }
   ```

2. **LivestockStatus** - 活体状态
   ```typescript
   // 应该定义在 livestock.entity.ts
   export enum LivestockStatus {
     ON_SALE = 1,   // 在售
     OFF_SALE = 2,  // 下架
   }
   ```

3. **LivestockTypeStatus** - 活体类型状态
   ```typescript
   // 应该定义在 livestock-type.entity.ts
   export enum LivestockTypeStatus {
     ENABLED = 1,   // 启用
     DISABLED = 2,  // 禁用
   }
   ```

4. **AdminStatus** - 管理员状态
   ```typescript
   // 应该定义在 admin.entity.ts
   export enum AdminStatus {
     ENABLED = 1,   // 启用
     DISABLED = 2,  // 禁用
   }
   ```

5. **AdminRole** - 管理员角色
   ```typescript
   // 应该定义在 admin.entity.ts
   export enum AdminRole {
     SUPER_ADMIN = 1,  // 超级管理员
     ADMIN = 2,        // 普通管理员
   }
   ```

---

## 八、命名规范建议

### 需要统一的项目

1. **API路径命名**
   - 当前：混合使用 kebab-case 和 camelCase
   - 建议：统一使用 kebab-case
   - 示例：`/feed-bills` 而非 `/feedBills`

2. **前端变量命名**
   - 当前：已统一使用 camelCase ✓
   - 保持现有规范

3. **组件命名**
   - 当前：已统一使用 PascalCase ✓
   - 保持现有规范

4. **文件命名**
   - 后端：已统一使用 kebab-case ✓
   - 前端：已统一使用 PascalCase ✓
   - 保持现有规范

---

## 九、修复优先级

### 高优先级（影响功能）
1. ✅ API路径不一致问题 - `/feed-bills` vs `/adoptions/feed-bills`
2. ✅ RedemptionOrder.type 字段类型不一致

### 中优先级（影响维护）
1. ID前缀文档更新
2. 编号生成规则文档更新
3. 缺失的枚举定义补充

### 低优先级（仅文档）
1. 命名规范文档完善
2. 注释规范统一

---

## 十、修复建议

### 立即修复

1. **修复前端API路径**
```typescript
// frontend/src/services/api.ts
// 修改以下路径
getFeedBillById: async (billId: string): Promise<FeedBill> => {
  return request(`/adoptions/feed-bills/${billId}`);  // 添加 adoptions 前缀
},

payFeedBill: async (billId: string, paymentMethod: string): Promise<PaymentResult> => {
  return request(`/adoptions/feed-bills/${billId}/pay`, {  // 添加 adoptions 前缀
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  });
},
```

2. **修复前端类型定义**
```typescript
// frontend/src/types/index.ts
// 修改 RedemptionOrder.type
interface RedemptionOrder {
  // ...
  type: number;  // 1=满期买断 2=提前买断
  // ...
}
```

### 后续优化

1. 在后端添加缺失的枚举定义
2. 更新 FIELD_NAMING_CONVENTIONS.md 文档
3. 添加前后端类型同步检查机制

---

*文档版本: 1.0.0*
*生成时间: 2026-04-08*
*检查文件数: 50+*
