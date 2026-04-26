-- ============================================================================
-- 数据库索引优化迁移
-- 日期：2026-04-25
-- 说明：根据查询模式分析，添加常用查询字段的索引
-- 注意：MySQL不支持 CREATE INDEX IF NOT EXISTS，重复执行会报错（可忽略）
-- ============================================================================

-- 1. 订单表索引
-- 用户订单列表查询（用户中心 -> 我的订单）
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- 管理后台订单筛选（按状态和时间）
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- 2. 领养表索引
-- 用户领养列表查询（我的牧场）
CREATE INDEX idx_adoptions_user_status ON adoptions(user_id, status);

-- 领养关联订单查询
CREATE INDEX idx_adoptions_order_id ON adoptions(order_id);

-- 3. 退款订单表索引
-- 防重复退款检查（核心安全索引）
CREATE INDEX idx_refund_orders_order_status ON refund_orders(order_id, status);

-- 用户退款列表查询
CREATE INDEX idx_refund_orders_user_status ON refund_orders(user_id, status);

-- 4. 余额变动记录表索引
-- 用户余额明细查询
CREATE INDEX idx_balance_logs_user_created ON balance_logs(user_id, created_at);

-- 5. 支付记录表索引
-- 退款原路返回查询（根据订单查找支付记录）
CREATE INDEX idx_payment_records_order ON payment_records(order_type, order_id);

-- 用户支付记录查询
CREATE INDEX idx_payment_records_user ON payment_records(user_id, created_at);

-- 6. 买断订单表索引
-- 用户买断列表查询
CREATE INDEX idx_redemption_orders_user_status ON redemption_orders(user_id, status);

-- 领养关联买断查询
CREATE INDEX idx_redemption_orders_adoption ON redemption_orders(adoption_id, status);

-- 7. 饲料费账单表索引
-- 用户饲料费列表查询
CREATE INDEX idx_feed_bills_user_status ON feed_bills(user_id, status);

-- 领养关联饲料费查询
CREATE INDEX idx_feed_bills_adoption ON feed_bills(adoption_id, status);

-- 8. 通知表索引
-- 用户通知列表查询
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at);

-- 9. 审计日志表索引
-- 管理员审计日志查询
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id, created_at);

-- 模块查询
CREATE INDEX idx_audit_logs_module ON audit_logs(module, created_at);