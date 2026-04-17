# 云端牧场后端代码审计报告

**审计日期**: 2026/04/17
**审计范围**: D:/Code/renyang-system/backend
**技术栈**: NestJS + TypeScript + MySQL + Redis + TypeORM

---

## 目录

1. [安全问题](#1-安全问题)
2. [Bug 和潜在错误](#2-bug-和潜在错误)
3. [代码规范问题](#3-代码规范问题)
4. [无效代码和冗余代码](#4-无效代码和冗余代码)
5. [性能问题](#5-性能问题)
6. [修复建议汇总](#6-修复建议汇总)

---

## 1. 安全问题

### 1.1 🔴 严重：JWT Secret 默认值

**文件**: `src/config/jwt.config.ts:4-5`

```typescript
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-secret-key',  // 严重问题！
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));
```

**问题**: JWT Secret 使用硬编码的默认值 `'your-secret-key'`，如果环境变量未配置，攻击者可以轻易伪造任意用户的 Token。

**修复建议**:
```typescript
export const jwtConfig = registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未配置');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET 长度必须至少32位');
  }
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
});
```

---

### 1.2 🔴 严重：AES 加密使用固定 IV

**文件**: `src/common/utils/crypto.util.ts:21-28`

```typescript
static aesEncrypt(text: string, key: string, iv?: string): string {
  const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  const ivBuffer = iv ? Buffer.from(iv.padEnd(16, '0').substring(0, 16)) : Buffer.alloc(16, 0); // 固定 IV！
  // ...
}
```

**问题**: 当未提供 IV 时，使用全零 IV (`Buffer.alloc(16, 0)`)，这会导致相同明文加密后产生相同密文，使攻击者可以进行模式分析攻击。

**修复建议**:
```typescript
static aesEncrypt(text: string, key: string, iv?: string): string {
  const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  // 生成随机 IV
  const ivBuffer = iv ? Buffer.from(iv.padEnd(16, '0').substring(0, 16)) : crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // 返回 IV + 密文
  return ivBuffer.toString('hex') + ':' + encrypted;
}

static aesDecrypt(encrypted: string, key: string): string {
  const [ivHex, ciphertext] = encrypted.split(':');
  const keyBuffer = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  const ivBuffer = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

### 1.3 🔴 严重：敏感配置信息可能在日志中泄露

**文件**: `src/app.module.ts:175-185`

```typescript
if (process.env.NODE_ENV === 'production') {
  if (process.env.ADMIN_DEFAULT_PASSWORD) {
    console.log('   密码: 请查看 ADMIN_DEFAULT_PASSWORD 环境变量');
  } else {
    console.log('   密码: 请查看服务器启动日志（仅显示一次）');
    console.log('   密码: ' + defaultPassword);  // 生产环境打印密码！
  }
} else {
  console.log('   密码: ' + defaultPassword);  // 开发环境也打印密码
}
```

**问题**: 生产环境打印了管理员默认密码，可能被日志系统记录，造成安全风险。

**修复建议**:
- 生产环境完全不打印密码
- 仅将密码写入安全的位置（如加密的配置文件）
- 使用后立即清除或要求首次登录强制修改

---

### 1.4 🟠 高危：SQL 查询使用原始查询

**文件**: `src/app.module.ts:159-172`

```typescript
const result = await this.dataSource.query(
  'SELECT COUNT(*) as count FROM admins WHERE username = ?',
  ['admin']
);
// ...
await this.dataSource.query(
  'INSERT INTO admins (id, username, password, name, role, status, force_change_password, created_at, updated_at) VALUES (UUID(), ?, ?, ?, 1, 1, 1, NOW(), NOW())',
  ['admin', hashedPassword, '超级管理员']
);
```

**问题**: 虽然使用了参数化查询，但原始 SQL 语句可能存在维护风险。建议使用 TypeORM 的 Repository 或 QueryBuilder。

**修复建议**: 使用 Repository 方法或 QueryBuilder 进行数据库操作。

---

### 1.5 🟠 高危：微信支付回调验签可绕过（已修复但需确认）

**文件**: `src/services/wechat-pay.service.ts:202-256`

代码中已添加签名验证逻辑，但需要确认以下问题：

```typescript
// 安全修复：API密钥未配置时，拒绝验签而非绕过
if (!apiV3Key) {
  this.logger.error('[WechatPay] API密钥未配置，拒绝验签');
  return false;
}
```

**建议**: 确保生产环境必须配置完整的支付密钥，测试环境应该使用独立的测试配置。

---

### 1.6 🟠 高危：密码强度验证不足

**文件**: `src/modules/auth/dto/auth.dto.ts:34-35`

```typescript
@Length(6, 20, { message: '密码长度为6-20位' })
password: string;
```

**问题**: 仅验证密码长度，没有验证密码复杂度（大小写字母、数字、特殊字符等）。

**修复建议**:
```typescript
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/, {
  message: '密码必须包含大小写字母、数字和特殊字符，长度8-20位'
})
password: string;
```

---

### 1.7 🟡 中危：短信验证码频率限制可被绕过

**文件**: `src/services/sms.service.ts:76-95`

```typescript
// 检查60秒内发送次数
const countKey = `sms:count:${phone}`;
const countStr = await this.redisService.get(countKey);
const count = parseInt(countStr || '0', 10);

if (count >= 5) {
  // 超过5次，拉黑10分钟
  await this.redisService.set(blacklistKey, '1', 600);
  throw new BadRequestException('验证码发送次数过多，请在10分钟后重试');
}
```

**问题**: 
1. 频率限制仅基于手机号，攻击者可以使用不同手机号绕过
2. 没有对 IP 进行限制
3. 验证码直接打印在开发环境日志中

**修复建议**:
- 添加 IP 级别的频率限制
- 添加设备指纹级别的限制
- 开发环境也不应在日志中打印完整验证码

---

### 1.8 🟡 中危：文件上传路径遍历风险

**文件**: `src/modules/upload/upload.service.ts:51-57`

```typescript
private getFilePath(filename: string, subDir?: string): string {
  const dir = subDir ? path.join(this.uploadDir, subDir) : this.uploadDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, filename);
}
```

**问题**: 没有验证 `filename` 和 `subDir` 是否包含路径遍历字符（如 `../`）。

**修复建议**:
```typescript
private getFilePath(filename: string, subDir?: string): string {
  // 防止路径遍历攻击
  const sanitizedFilename = path.basename(filename);
  const sanitizedSubDir = subDir ? subDir.replace(/\.\./g, '') : undefined;
  const dir = sanitizedSubDir ? path.join(this.uploadDir, sanitizedSubDir) : this.uploadDir;
  // ...
}
```

---

### 1.9 🟡 中危：缺少登录失败锁定机制

**文件**: `src/modules/auth/auth.service.ts:101-138`

**问题**: 密码登录没有失败次数限制，可能遭受暴力破解攻击。

**修复建议**: 添加登录失败次数限制，超过阈值后锁定账户或增加验证码验证。

---

### 1.10 🟢 低危：CORS 配置默认允许所有来源

**文件**: `src/main.ts:18-21`

```typescript
app.enableCors({
  origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : true,
  credentials: true,
});
```

**问题**: 如果 `CORS_ORIGIN` 环境变量未配置，`origin: true` 允许任何来源访问。

**修复建议**: 生产环境应强制配置 `CORS_ORIGIN` 或拒绝启动。

---

## 2. Bug 和潜在错误

### 2.1 🔴 严重：库存扣减失败不回滚

**文件**: `src/modules/order/order.service.ts:174-179`

```typescript
// 扣减库存
try {
  await this.livestockService.updateStock(order.livestockId, -1);
} catch (error) {
  // 库存扣减失败但订单已支付，记录错误但不回滚
  console.error('库存扣减失败:', error);
}
```

**问题**: 库存扣减失败后，事务仍然提交，导致已支付订单但库存未扣减的数据不一致。

**修复建议**: 库存扣减失败应触发事务回滚或抛出异常。

---

### 2.2 🔴 严重：余额操作没有使用数据库事务

**文件**: `src/modules/user/user.service.ts:49-84`

```typescript
async updateBalance(userId: string, amount: number, remark: string) {
  const user = await this.userRepository.findOne({ where: { id: userId } });
  // ... 余额检查
  
  // 更新余额 - 保留两位小数
  const finalBalance = Math.round(balanceAfter * 100) / 100;
  await this.userRepository.update(userId, { balance: finalBalance });  // 更新余额

  // 记录流水
  const log = this.balanceLogRepository.create({...});
  await this.balanceLogRepository.save(log);  // 记录日志
  
  // 更新缓存
  await this.redisService.set(`user:balance:${userId}`, finalBalance.toString());
}
```

**问题**: 余额更新和日志记录不在同一个事务中，如果日志记录失败，余额已被更新，导致数据不一致。

**修复建议**: 使用数据库事务包装这两个操作。

---

### 2.3 🟠 高危：微信回调 body 被重复序列化

**文件**: `src/modules/payment/payment.controller.ts:120-128`

```typescript
@Post('wechat/notify')
@Public()
async wechatNotify(@Body() data: any, @Req() req: any) {
  // 安全修复：验证签名
  const headers = req.headers;
  const body = JSON.stringify(data);  // 问题：data 已经是解析后的对象
  const isValid = await this.paymentService.verifyWechatNotify(headers, body);
```

**问题**: `data` 已经是请求体解析后的对象，再次 `JSON.stringify` 可能产生与原始请求不同的字符串，导致签名验证失败。

**修复建议**: 应该获取原始请求体进行签名验证，或者调整验证逻辑。

---

### 2.4 🟠 高危：分布式锁未正确释放

**文件**: `src/common/utils/redis.service.ts:175-185`

```typescript
async withLock<T>(key: string, ttl: number, task: () => Promise<T>): Promise<T> {
  const acquired = await this.acquireLock(key, ttl);
  if (!acquired) {
    throw new Error('获取锁失败，请稍后重试');
  }
  try {
    return await task();
  } finally {
    await this.releaseLock(key);  // 问题：如果任务超时，锁已被自动释放，这里可能释放其他任务的锁
  }
}
```

**问题**: 如果任务执行时间超过 TTL，锁会被自动释放，然后 `finally` 块可能删除其他请求获得的锁。

**修复建议**: 使用 Lua 脚本确保只释放自己持有的锁：
```typescript
async releaseLock(key: string, value: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await this.client.eval(script, 1, key, value);
  return result === 1;
}
```

---

### 2.5 🟠 高危：订单创建后未检查 stock 缓存一致性

**文件**: `src/modules/livestock/livestock.service.ts:61-76`

```typescript
async getStock(id: string): Promise<number> {
  const stockKey = `livestock:stock:${id}`;
  const cachedStock = await this.redisService.get(stockKey);

  if (cachedStock) {
    return parseInt(cachedStock, 10);  // 缓存可能过期
  }
  // ...
}
```

**问题**: 库存缓存可能过期，需要考虑缓存与数据库的一致性。

---

### 2.6 🟡 中危：验证码验证后未设置过期

**文件**: `src/services/sms.service.ts:144-156`

```typescript
async verifyCode(phone: string, code: string, type: string): Promise<boolean> {
  const codeKey = `sms:code:${phone}:${type}`;
  const storedCode = await this.redisService.get(codeKey);

  if (!storedCode) {
    throw new BadRequestException('验证码已过期');
  }

  if (storedCode !== code) {
    throw new BadRequestException('验证码错误');
  }

  return true;  // 验证成功但未删除验证码
}
```

**问题**: 验证成功后验证码仍然有效，可能被重复使用。虽然 `markCodeUsed` 会删除，但需要确保调用顺序正确。

---

### 2.7 🟡 中危：类型断言可能导致运行时错误

**文件**: `src/modules/payment/payment.service.ts:66-73`

```typescript
case 'feed': {
  const feedBill = await this.paymentRepository.manager.findOne('FeedBill' as any, {
    where: { id: orderId },
  }) as any;  // 使用 as any 绕过类型检查
  if (!feedBill) {
    throw new BadRequestException('饲料账单不存在');
  }
  expectedAmount = Number(feedBill.amount);
  break;
}
```

**问题**: 使用 `as any` 绕过类型检查，可能导致运行时错误。

**修复建议**: 使用正确的实体类型和 Repository。

---

### 2.8 🟡 中危：微信授权回调使用 GET 而非 POST

**文件**: `src/modules/auth/auth.controller.ts:103-110`

```typescript
@Public()
@Get('wechat/callback')  // 使用 GET 方法
@ApiOperation({ summary: '微信授权回调' })
@ApiResponse({ status: 200, description: '授权成功' })
async wechatCallback(@Body('code') code: string, @Body('state') state: string) {  // GET 请求通常没有 Body
  return this.authService.wechatCallback(code, state);
}
```

**问题**: GET 请求通常不会携带请求体，微信回调的 code 和 state 应该在查询参数中。

**修复建议**: 使用 `@Query()` 获取参数。

---

### 2.9 🟢 低危：未处理的 Promise

**文件**: `src/modules/admin/admin.service.ts:1306-1308`

```typescript
// 发送站内信通知用户
try {
  await this.notificationService.createNotification({...});
} catch (error) {
  console.error('Failed to send notification:', error);  // 仅打印错误，未处理
}
```

**问题**: 通知发送失败仅打印日志，可能导致用户无法收到重要通知。

---

### 2.10 🟢 低危：缺少空值检查

**文件**: `src/modules/adoption/adoption.service.ts:217-220`

```typescript
const livestock = adoption.livestockSnapshot as Livestock;
const requiredMonths = adoption.redemptionMonths - 1;
const remainingMonths = Math.max(0, requiredMonths - adoption.feedMonthsPaid);
const amount = remainingMonths * (livestock.monthlyFeedFee || 0);
```

**问题**: `livestockSnapshot` 可能为空或格式不正确，需要验证。

---

## 3. 代码规范问题

### 3.1 命名规范问题

| 文件 | 行号 | 问题 | 建议 |
|------|------|------|------|
| `src/entities/user.entity.ts` | 19 | 使用 `id` 作为主键但类型是 `varchar(32)`，应该明确命名 | 保持一致 |
| `src/modules/order/order.service.ts` | 122 | `where: any` 应该使用明确的类型 | 定义类型接口 |
| `src/modules/admin/admin.service.ts` | 817 | `where: any` 应该使用明确的类型 | 定义类型接口 |

### 3.2 代码风格一致性

**问题**: 部分文件使用 `console.log`，部分使用 `Logger`。

**文件**: 
- `src/app.module.ts:173-186` - 使用 `console.log`
- `src/services/sms.service.ts` - 使用 `Logger`

**建议**: 统一使用 NestJS 的 `Logger` 服务。

### 3.3 TypeScript 类型定义问题

**文件**: `src/modules/order/order.service.ts:121-127`

```typescript
async getById(orderId: string, userId?: string) {
  const where: any = { id: orderId };  // 使用 any
  if (userId) {
    where.userId = userId;
  }
  return this.orderRepository.findOne({ where, relations: ['livestock', 'user'] });
}
```

**建议**: 定义明确的类型，避免使用 `any`。

### 3.4 注释和文档

**问题**: 
1. 部分复杂业务逻辑缺少注释
2. 部分方法缺少返回值说明
3. 异常情况未在注释中说明

**示例**: `src/modules/admin/admin.service.ts` 中的 `adjustUserBalance` 方法需要更详细的注释说明并发处理。

### 3.5 魔法数字

**文件**: `src/services/sms.service.ts:92`

```typescript
if (count >= 5) {  // 魔法数字 5
  await this.redisService.set(blacklistKey, '1', 600);  // 魔法数字 600
```

**建议**: 将这些数字提取为命名常量：
```typescript
const SMS_MAX_COUNT_PER_MINUTE = 5;
const SMS_BLACKLIST_DURATION_SECONDS = 600;
```

---

## 4. 无效代码和冗余代码

### 4.1 未使用的导入

**文件**: `src/modules/admin/admin.controller.ts:5`

```typescript
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';
// IsObject 未使用
```

### 4.2 未使用的变量

**文件**: `src/services/wechat-pay.service.ts:463`

```typescript
const transactionId = refundData.transaction_id;  // 未使用
```

### 4.3 死代码

**文件**: `src/modules/auth/auth.service.ts:230-240`

```typescript
async wechatCallback(code: string, state: string) {
  // ...
  // TODO: 实现微信授权回调
  throw new BadRequestException('微信登录功能暂未开放');
}

async bindPhone(dto: BindPhoneDto) {
  // TODO: 实现绑定手机号功能
  throw new BadRequestException('绑定手机号功能暂未开放');
}
```

**建议**: 如果功能未实现，应该移除相关路由或添加明确的开发状态标记。

### 4.4 重复代码

**问题**: 多个 Service 中存在相似的余额更新逻辑。

**文件**:
- `src/modules/user/user.service.ts:49-84`
- `src/modules/admin/admin.service.ts:336-382`

**建议**: 提取为共用的服务或方法。

---

## 5. 性能问题

### 5.1 N+1 查询问题

**文件**: `src/modules/user/user.service.ts:26-34`

```typescript
// 获取领养统计数据
const adoptions = await this.adoptionRepository.find({ where: { userId: id } });
const adoptionsCount = adoptions.length;
// 计算总领养天数
const totalDays = adoptions.reduce((sum, adoption) => {
  // ...
}, 0);
```

**问题**: 获取所有领养记录后仅在内存中计算，应该使用数据库聚合查询。

**修复建议**:
```typescript
const adoptionsCount = await this.adoptionRepository.count({ where: { userId: id } });
// 使用数据库聚合计算天数
```

### 5.2 缺少数据库索引

**文件**: `src/entities/order.entity.ts`

**问题**: 以下字段可能需要索引但未添加：
- `status` - 经常用于状态查询
- `createdAt` - 经常用于排序和日期范围查询
- `paidAt` - 用于收入统计

**建议**: 根据实际查询模式添加索引。

### 5.3 不必要的数据库查询

**文件**: `src/modules/livestock/livestock.service.ts:78-98`

```typescript
async updateStock(id: string, quantity: number): Promise<boolean> {
  // ... 更新操作
  
  // 更新缓存
  const livestock = await this.livestockRepository.findOne({ where: { id } });  // 再次查询
  if (livestock) {
    await this.redisService.set(stockKey, livestock.stock.toString());
  }
}
```

**问题**: 更新后重新查询数据库来更新缓存，应该直接计算新值更新缓存。

### 5.4 缓存策略不足

**问题**: 
1. 系统配置缓存时间仅 5 分钟 (`src/services/alipay.service.ts:50`)
2. 活体类型等静态数据应该缓存更长时间
3. 缺少缓存预热机制

### 5.5 大数据量处理

**文件**: `src/tasks/tasks.service.ts:76-86`

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async cancelExpiredOrders() {
  // ...
  await this.orderService.cancelExpiredOrders();
}
```

**文件**: `src/modules/order/order.service.ts:237-260`

```typescript
async cancelExpiredOrders() {
  const expiredOrderIds = await this.redisService.zrangebyscore('delay:queue:order', 0, now);
  
  for (const orderId of expiredOrderIds) {  // 可能大量订单
    try {
      await this.handleOrderExpire(orderId);  // 逐个处理
    }
  }
}
```

**问题**: 过期订单处理是串行的，大量订单可能导致处理延迟。

**建议**: 使用批量处理或并行处理。

---

## 6. 修复建议汇总

### 优先级排序

#### P0 - 必须立即修复
1. JWT Secret 默认值问题
2. AES 加密固定 IV 问题
3. 库存扣减失败不回滚
4. 余额操作事务问题

#### P1 - 尽快修复
1. 密码强度验证不足
2. 登录失败锁定机制
3. 分布式锁释放问题
4. 文件上传路径遍历

#### P2 - 计划修复
1. 短信验证码频率限制加强
2. N+1 查询优化
3. 缓存策略优化
4. 代码规范统一

#### P3 - 持续改进
1. 移除死代码
2. 消除重复代码
3. 完善注释文档
4. 类型定义优化

---

## 附录：代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 安全性 | 6/10 | 存在多个安全漏洞需修复 |
| 可靠性 | 7/10 | 事务处理和数据一致性需加强 |
| 可维护性 | 7/10 | 代码结构清晰，但类型定义需完善 |
| 性能 | 7/10 | 存在 N+1 查询和缓存问题 |
| 规范性 | 7/10 | 整体规范，但有细节需改进 |

**总体评分**: 6.8/10

---

*报告生成时间: 2026-04-17*
