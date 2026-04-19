-- 添加支付记录新字段
-- 执行日期: 2026-04-19
-- 说明: 添加 transaction_id 存储第三方交易号，version 字段支持乐观锁

-- 添加第三方交易号字段
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64) NULL COMMENT '第三方交易号';

-- 添加乐观锁版本号字段
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT '乐观锁版本号';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_payment_records_transaction_id ON payment_records(transaction_id);
