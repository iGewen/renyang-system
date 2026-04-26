-- ============================================================
-- Phase 8: 订单状态扩展 + 订单历史表
-- 执行前请备份数据库
-- ============================================================

-- 1. 扩展 orders 表 status 字段范围
-- 当前 status 是 tinyint，值范围 1-4，新增 5-8
-- tinyint 范围 -128~127，无需修改列类型
-- 但需确认 comment 更新
ALTER TABLE `orders` MODIFY COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 1待支付 2已支付 3已取消 4已退款 5退款审核中 6退款处理中 7退款失败 8管理员强制取消';

-- 2. 创建订单历史表
CREATE TABLE IF NOT EXISTS `order_history` (
  `id` varchar(32) NOT NULL COMMENT '历史记录ID',
  `order_id` varchar(32) NOT NULL COMMENT '订单ID',
  `from_status` tinyint DEFAULT NULL COMMENT '变更前状态',
  `to_status` tinyint NOT NULL COMMENT '变更后状态',
  `operator_id` varchar(32) DEFAULT NULL COMMENT '操作人ID',
  `operator_type` varchar(20) NOT NULL COMMENT '操作人类型: user/admin/system',
  `remark` varchar(500) DEFAULT NULL COMMENT '变更原因/备注',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_order_history_order_id` (`order_id`),
  INDEX `idx_order_history_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单历史记录';
