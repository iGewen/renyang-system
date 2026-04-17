-- ===========================================
-- 云端牧场 - 添加 livestock_no 字段迁移脚本
-- ===========================================
-- 使用方法：在已有数据库上执行此脚本添加 livestock_no 字段
-- ===========================================

-- 添加 livestock_no 字段
ALTER TABLE `livestock`
ADD COLUMN `livestock_no` varchar(20) DEFAULT NULL COMMENT '活体编号(领养编号)' AFTER `id`;

-- 添加索引
ALTER TABLE `livestock`
ADD INDEX `idx_livestock_no` (`livestock_no`);

-- 为现有记录生成 livestock_no（格式：HT + YYMMDDHHmmss）
-- 注意：由于现有记录无法确定原始创建时间，使用当前时间生成编号
-- 如果有大量记录，建议分批执行或使用程序生成唯一编号

-- 完成
SELECT 'livestock_no 字段添加完成!' AS message;
