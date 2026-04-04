-- ===========================================
-- 云端牧场数据库初始化脚本
-- ===========================================
-- 使用方法：
-- 1. 创建数据库：
--    CREATE DATABASE cloud_ranch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 2. 使用数据库：
--    USE cloud_ranch;
-- 3. 执行本脚本
-- ===========================================

-- 创建用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) NOT NULL,
  `phone` varchar(11) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `wechat_openid` varchar(64) DEFAULT NULL,
  `wechat_unionid` varchar(64) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1正常 2禁用',
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_phone` (`phone`),
  KEY `idx_wechat_openid` (`wechat_openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 创建余额流水表
CREATE TABLE IF NOT EXISTS `balance_logs` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `type` tinyint NOT NULL COMMENT '1充值 2消费 3退款 4调整',
  `amount` decimal(10,2) NOT NULL,
  `balance_before` decimal(10,2) NOT NULL,
  `balance_after` decimal(10,2) NOT NULL,
  `related_type` varchar(20) DEFAULT NULL,
  `related_id` varchar(36) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `operator_id` varchar(36) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='余额流水表';

-- 创建活体类型表
CREATE TABLE IF NOT EXISTS `livestock_types` (
  `id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `description` text,
  `sort_order` int DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 2禁用',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活体类型表';

-- 创建活体表
CREATE TABLE IF NOT EXISTS `livestock` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type_id` varchar(36) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `monthly_feed_fee` decimal(10,2) NOT NULL,
  `redemption_months` int NOT NULL DEFAULT '12',
  `description` text,
  `images` json DEFAULT NULL,
  `main_image` varchar(500) DEFAULT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `sold_count` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1上架 2下架',
  `sort_order` int DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type_id` (`type_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活体表';

-- 创建订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(36) NOT NULL,
  `order_no` varchar(32) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `livestock_id` varchar(36) NOT NULL,
  `livestock_snapshot` json NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `total_amount` decimal(10,2) NOT NULL,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_no` varchar(64) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1待支付 2已支付 3已取消 4已退款',
  `expire_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `client_order_id` varchar(36) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_livestock_id` (`livestock_id`),
  KEY `idx_status` (`status`),
  KEY `idx_client_order_id` (`client_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 创建领养记录表
CREATE TABLE IF NOT EXISTS `adoptions` (
  `id` varchar(36) NOT NULL,
  `adoption_no` varchar(32) NOT NULL,
  `order_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `livestock_id` varchar(36) NOT NULL,
  `livestock_snapshot` json NOT NULL,
  `start_date` date NOT NULL,
  `redemption_months` int NOT NULL,
  `feed_months_paid` int NOT NULL DEFAULT '0',
  `total_feed_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `late_fee_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1领养中 2饲料费逾期 3异常 4可买断 5买断审核中 6已买断 7已终止',
  `current_feed_bill_id` varchar(36) DEFAULT NULL,
  `is_exception` tinyint NOT NULL DEFAULT '0',
  `exception_reason` varchar(255) DEFAULT NULL,
  `exception_at` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_adoption_no` (`adoption_no`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_livestock_id` (`livestock_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='领养记录表';

-- 创建饲料费账单表
CREATE TABLE IF NOT EXISTS `feed_bills` (
  `id` varchar(36) NOT NULL,
  `bill_no` varchar(32) NOT NULL,
  `adoption_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `livestock_id` varchar(36) NOT NULL,
  `bill_month` varchar(7) NOT NULL,
  `bill_date` date NOT NULL,
  `original_amount` decimal(10,2) NOT NULL,
  `adjusted_amount` decimal(10,2) DEFAULT NULL,
  `late_fee_rate` decimal(10,4) NOT NULL DEFAULT '0.0010',
  `late_fee_cap` decimal(10,2) DEFAULT NULL,
  `late_fee_days` int NOT NULL DEFAULT '0',
  `late_fee_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_late_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `late_fee_start_date` date DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1待支付 2已支付 3已逾期 4已免除',
  `paid_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_no` varchar(64) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `adjust_reason` varchar(255) DEFAULT NULL,
  `operator_id` varchar(36) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bill_no` (`bill_no`),
  KEY `idx_adoption_id` (`adoption_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='饲料费账单表';

-- 创建买断订单表
CREATE TABLE IF NOT EXISTS `redemption_orders` (
  `id` varchar(36) NOT NULL,
  `redemption_no` varchar(32) NOT NULL,
  `adoption_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `livestock_id` varchar(36) NOT NULL,
  `type` tinyint NOT NULL COMMENT '1满期买断 2提前买断',
  `original_amount` decimal(10,2) NOT NULL,
  `adjusted_amount` decimal(10,2) DEFAULT NULL,
  `final_amount` decimal(10,2) NOT NULL,
  `adjust_reason` varchar(255) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1待审核 2审核通过 3审核拒绝 4已支付 5已取消',
  `audit_admin_id` varchar(36) DEFAULT NULL,
  `audit_at` datetime DEFAULT NULL,
  `audit_remark` varchar(255) DEFAULT NULL,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(20) DEFAULT NULL,
  `payment_no` varchar(64) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `expire_at` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_redemption_no` (`redemption_no`),
  KEY `idx_adoption_id` (`adoption_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='买断订单表';

-- 创建退款订单表
CREATE TABLE IF NOT EXISTS `refund_orders` (
  `id` varchar(36) NOT NULL,
  `refund_no` varchar(32) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `order_type` varchar(20) NOT NULL,
  `order_id` varchar(36) NOT NULL,
  `original_amount` decimal(10,2) NOT NULL,
  `refund_amount` decimal(10,2) NOT NULL,
  `refund_livestock` tinyint NOT NULL DEFAULT '2' COMMENT '1是 2否',
  `reason` varchar(255) DEFAULT NULL,
  `type` tinyint NOT NULL COMMENT '1用户申请 2管理员操作 3系统自动',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1待审核 2审核通过 3审核拒绝 4已退款 5已取消',
  `audit_admin_id` varchar(36) DEFAULT NULL,
  `audit_at` datetime DEFAULT NULL,
  `audit_remark` varchar(255) DEFAULT NULL,
  `operator_id` varchar(36) DEFAULT NULL,
  `refund_method` varchar(20) DEFAULT NULL,
  `refund_at` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_refund_no` (`refund_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款订单表';

-- 创建支付记录表
CREATE TABLE IF NOT EXISTS `payment_records` (
  `id` varchar(36) NOT NULL,
  `payment_no` varchar(32) NOT NULL,
  `out_trade_no` varchar(64) DEFAULT NULL,
  `user_id` varchar(36) NOT NULL,
  `order_type` varchar(20) NOT NULL,
  `order_id` varchar(36) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(20) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1待支付 2已支付 3失败',
  `paid_at` datetime DEFAULT NULL,
  `notify_at` datetime DEFAULT NULL,
  `notify_data` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_payment_no` (`payment_no`),
  KEY `idx_out_trade_no` (`out_trade_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_order` (`order_type`, `order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

-- 创建通知表
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `title` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `type` varchar(20) NOT NULL,
  `related_type` varchar(20) DEFAULT NULL,
  `related_id` varchar(36) DEFAULT NULL,
  `is_read` tinyint NOT NULL DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';

-- 创建短信验证码表
CREATE TABLE IF NOT EXISTS `sms_codes` (
  `id` varchar(36) NOT NULL,
  `phone` varchar(11) NOT NULL,
  `code` varchar(6) NOT NULL,
  `type` varchar(20) NOT NULL,
  `is_used` tinyint NOT NULL DEFAULT '0',
  `expire_at` datetime NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_phone_type` (`phone`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信验证码表';

-- 创建管理员表
CREATE TABLE IF NOT EXISTS `admins` (
  `id` varchar(36) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `phone` varchar(11) DEFAULT NULL,
  `avatar` varchar(500) DEFAULT NULL,
  `role` tinyint NOT NULL DEFAULT '2' COMMENT '1超级管理员 2普通管理员',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1启用 2禁用',
  `last_login_at` datetime DEFAULT NULL,
  `last_login_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` varchar(36) NOT NULL,
  `config_key` varchar(50) NOT NULL,
  `config_value` text,
  `config_type` varchar(20) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_encrypted` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` varchar(36) DEFAULT NULL,
  `admin_name` varchar(50) DEFAULT NULL,
  `module` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `target_id` varchar(36) DEFAULT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `is_sensitive` tinyint NOT NULL DEFAULT '0',
  `remark` varchar(500) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_target_id` (`target_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';

-- ===========================================
-- 插入初始数据
-- ===========================================

-- 插入默认管理员账号 (密码: admin123456)
-- 注意：实际使用时需要用 bcrypt 加密
INSERT INTO `admins` (`id`, `username`, `password`, `name`, `role`, `status`, `created_at`, `updated_at`)
VALUES ('A001', 'admin', '$2a$10$YourHashedPasswordHere', '超级管理员', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `username` = `username`;

-- 插入默认活体类型
INSERT INTO `livestock_types` (`id`, `name`, `icon`, `description`, `sort_order`, `status`, `created_at`, `updated_at`)
VALUES
('LT001', '山羊', 'goat', '温顺可爱的山羊', 1, 1, NOW(), NOW()),
('LT002', '绵羊', 'sheep', '毛茸茸的绵羊', 2, 1, NOW(), NOW()),
('LT003', '黄牛', 'cattle', '强壮的黄牛', 3, 1, NOW(), NOW()),
('LT004', '水牛', 'buffalo', '勤劳的水牛', 4, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 插入默认系统配置
INSERT INTO `system_configs` (`id`, `config_key`, `config_value`, `config_type`, `description`, `created_at`, `updated_at`)
VALUES
('SC001', 'late_fee_config', '{"startDays": 3, "rate": 0.001, "capRate": 0.5}', 'business', '滞纳金配置', NOW(), NOW()),
('SC002', 'feed_bill_config', '{"generateAdvanceDays": 5}', 'business', '饲料费账单配置', NOW(), NOW()),
('SC003', 'order_config', '{"expireMinutes": 15}', 'business', '订单配置', NOW(), NOW())
ON DUPLICATE KEY UPDATE `config_key` = VALUES(`config_key`);

-- ===========================================
-- 完成
-- ===========================================
SELECT '数据库初始化完成!' AS message;
