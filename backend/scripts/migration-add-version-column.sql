-- 添加乐观锁版本号字段
-- 执行日期: 2026-04-19
-- 说明: 为关键实体添加 version 字段实现乐观锁，防止并发更新冲突

-- 用户表添加版本号
ALTER TABLE users ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT '乐观锁版本号';

-- 订单表添加版本号
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT '乐观锁版本号';

-- 饲料费账单表添加版本号
ALTER TABLE feed_bills ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT '乐观锁版本号';
