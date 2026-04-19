# 修复日志

本文档记录所有代码修复，避免重复修复或遗漏问题。

## 修复日期: 2026-04-19

### 1. 支付回调金额验证 [支付] - 已修复
**文件**: `backend/src/modules/payment/payment.service.ts`
**问题**: 支付宝和微信支付回调未验证返回金额是否与订单金额一致
**修复**: 添加金额验证逻辑
**状态**: ✅ 已修复

### 2. 模拟环境绕过支付验证 [支付] - 已修复
**文件**: `backend/src/services/alipay.service.ts`, `backend/src/services/wechat-pay.service.ts`
**问题**: 配置缺失时 queryOrder/退款 直接返回成功状态
**修复**: 配置缺失时抛出异常而非返回模拟数据
**状态**: ✅ 已修复

### 3. 支付宝回调覆盖 paymentNo [支付] - 已修复
**文件**: `backend/src/modules/payment/payment.service.ts:322`
**问题**: 将支付宝交易号直接覆盖了原本的 paymentNo
**修复**: 使用新字段 transactionId 存储第三方交易号
**状态**: ✅ 已修复

### 4. XSS 风险 [前端安全] - 已修复
**文件**: `frontend/src/App.tsx`
**问题**: 协议内容直接渲染，可能存在 XSS 风险
**修复**: 使用 DOMPurify 净化内容
**状态**: ✅ 已修复

### 5. Token 解析错误处理 [前端安全] - 已修复
**文件**: `frontend/src/services/api.ts`
**问题**: 使用 atob 解析 JWT payload 无错误处理
**修复**: 添加 try-catch 和格式验证
**状态**: ✅ 已修复

### 6. 定时器泄漏 [前端Bug] - 已修复
**文件**: `frontend/src/App.tsx`
**问题**: 发送验证码的 setInterval 没有保存引用
**修复**: 使用 useRef 跟踪并清理定时器
**状态**: ✅ 已修复

### 7. 支付金额边界检查 [支付] - 已修复
**文件**: `backend/src/modules/payment/payment.controller.ts`
**问题**: CreatePaymentDto 缺少金额范围校验
**修复**: 添加 @Min/@Max 装饰器
**状态**: ✅ 已修复

### 8. AdoptionService.handleFeedBillPaymentSuccess 缺少事务 [业务] - 已修复
**文件**: `backend/src/modules/adoption/adoption.service.ts`
**问题**: 该方法没有使用事务和分布式锁
**修复**: 添加事务保护和幂等性检查
**状态**: ✅ 已修复

### 9. 支付状态检查使用 paidAt 不可靠 [支付] - 已修复
**文件**: `backend/src/modules/payment/payment.service.ts`
**问题**: 仅应使用 status 判断状态
**修复**: 修改判断条件
**状态**: ✅ 已修复

### 10. 退款单号生成碰撞风险 [支付] - 已修复
**文件**: `backend/src/services/alipay.service.ts`, `backend/src/services/wechat-pay.service.ts`
**问题**: 时间戳+4位随机字符可能碰撞
**修复**: 增加随机字符长度或使用UUID
**状态**: ✅ 已修复

### 11. 微信时间戳验证整数溢出 [支付] - 已修复
**文件**: `backend/src/services/wechat-pay.service.ts`
**问题**: 未检查负数或极端大值
**修复**: 添加边界检查
**状态**: ✅ 已修复

### 12. 支付宝签名验证缺少 app_id 验证 [支付] - 已修复
**文件**: `backend/src/services/alipay.service.ts`
**问题**: 未验证回调的 app_id 是否匹配
**修复**: 添加 app_id 验证
**状态**: ✅ 已修复

### 13. 微信回调缺少商户号验证 [支付] - 已修复
**文件**: `backend/src/services/wechat-pay.service.ts`
**问题**: 未验证回调的 mchid 是否匹配
**修复**: 添加商户号验证
**状态**: ✅ 已修复

### 14. 支付宝回调缺少 notify_id 防重放检查 [支付] - 已修复
**文件**: `backend/src/services/alipay.service.ts`
**问题**: 未检查 notify_id 唯一性
**修复**: 使用 Redis 存储 notify_id 防止重放
**状态**: ✅ 已修复

### 15. 前端敏感信息 console.log [前端] - 已修复
**文件**: `frontend/src/services/api.ts`
**问题**: 打印敏感信息到控制台
**修复**: 移除 console.log
**状态**: ✅ 已修复

### 16. 前端轮询未正确清理 [前端] - 已修复
**文件**: `frontend/src/App.tsx`
**问题**: PaymentResultPage 轮询定时器未清理
**修复**: 添加 useEffect 清理函数
**状态**: ✅ 已修复

### 17. 前端 TabBar 频繁请求未读消息 [前端] - 已修复
**文件**: `frontend/src/App.tsx`
**问题**: 每次路由变化都重新请求
**修复**: 添加防抖和缓存机制
**状态**: ✅ 已修复

### 18. 实体主键定义不规范 [数据层] - 已修复
**文件**: `backend/src/entities/*.entity.ts`
**问题**: 使用 @Column({ primary: true }) 而非 @PrimaryColumn
**修复**: 改为 @PrimaryColumn
**状态**: ✅ 已修复

### 19. 缺失乐观锁版本字段 [数据层] - 已修复
**文件**: 多个实体文件
**问题**: Adoption, RefundOrder 等缺少 @VersionColumn
**修复**: 添加版本字段
**状态**: ✅ 已修复

### 20. 库存扣减缺少并发保护 [业务] - 已修复
**文件**: `backend/src/modules/order/order.service.ts`
**问题**: 高并发下可能超卖
**修复**: 使用乐观锁或原子更新
**状态**: ✅ 已修复

### 21. 事务内执行 Redis 操作 [业务] - 已修复
**文件**: `backend/src/modules/order/order.service.ts`
**问题**: Redis 操作在事务内，可能导致不一致
**修复**: 将 Redis 操作移到事务外
**状态**: ✅ 已修复

### 22. 饲料费支付未调用处理方法 [业务] - 已修复
**文件**: `backend/src/modules/payment/payment.service.ts`
**问题**: 饲料费支付成功后没有调用 FeedService
**修复**: 注入 FeedService 并调用处理方法
**状态**: ✅ 已修复

### 23. 定时任务分布式锁释放时机 [业务] - 已修复
**文件**: `backend/src/tasks/tasks.service.ts`
**问题**: 异常时锁不会被释放
**修复**: 使用 try-finally 确保释放
**状态**: ✅ 已修复

### 24. 订单查询越权风险 [业务] - 已修复
**文件**: `backend/src/modules/order/order.service.ts`
**问题**: getById 方法 userId 参数可选
**修复**: 强制验证订单归属
**状态**: ✅ 已修复

### 25. 退款时事务内调用外部 API [业务] - 已修复
**文件**: `backend/src/modules/refund/refund.service.ts`
**问题**: HTTP 请求在事务内执行
**修复**: 将外部调用移到事务外
**状态**: ✅ 已修复

---

## 待修复问题

(无)

---

## 注意事项

1. 所有支付相关的金额验证必须使用绝对值比较（考虑浮点数精度）
2. 配置缺失时应抛出异常，不应返回模拟数据
3. 事务内不应执行外部 API 调用或 Redis 操作
4. 所有状态判断应使用 status 字段，不依赖 paidAt 等
5. 定时器必须在组件卸载时清理
