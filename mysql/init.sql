-- 云端牧场数据库初始化脚本
-- 在首次启动时由 MySQL 容器自动执行

USE cloud_ranch;

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) NOT NULL COMMENT '用户ID',
    phone VARCHAR(11) NOT NULL COMMENT '手机号',
    password VARCHAR(255) NULL COMMENT '密码（加密）',
    nickname VARCHAR(50) NULL COMMENT '昵称',
    avatar VARCHAR(500) NULL COMMENT '头像',
    wechat_openid VARCHAR(64) NULL COMMENT '微信OpenID',
    wechat_unionid VARCHAR(64) NULL COMMENT '微信UnionID',
    balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '余额',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
    last_login_at DATETIME NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) NULL COMMENT '最后登录IP',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    deleted_at DATETIME(6) NULL COMMENT '软删除时间',
    version INT DEFAULT 1 COMMENT '乐观锁版本号',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_users_phone (phone),
    UNIQUE INDEX IDX_users_wechat_openid (wechat_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(32) NOT NULL COMMENT '管理员ID',
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
    name VARCHAR(50) NULL COMMENT '姓名',
    phone VARCHAR(11) NULL COMMENT '手机号',
    avatar VARCHAR(500) NULL COMMENT '头像',
    role TINYINT DEFAULT 2 COMMENT '角色：1超级管理员 2普通管理员',
    status TINYINT DEFAULT 1 COMMENT '状态：1启用 2禁用',
    force_change_password TINYINT DEFAULT 0 COMMENT '是否需要强制修改密码：0否 1是',
    last_login_at DATETIME NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) NULL COMMENT '最后登录IP',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    deleted_at DATETIME(6) NULL COMMENT '软删除时间',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_admins_username (username),
    INDEX IDX_admins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- 活体类型表
CREATE TABLE IF NOT EXISTS livestock_types (
    id VARCHAR(32) NOT NULL COMMENT '类型ID',
    name VARCHAR(50) NOT NULL COMMENT '类型名称',
    icon VARCHAR(500) NULL COMMENT '图标URL',
    description TEXT NULL COMMENT '描述',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态：1启用 2禁用',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活体类型表';

-- 活体表
CREATE TABLE IF NOT EXISTS livestock (
    id VARCHAR(32) NOT NULL COMMENT '活体ID',
    livestock_no VARCHAR(24) NULL COMMENT '活体编号(领养编号)',
    type_id VARCHAR(32) NOT NULL COMMENT '类型ID',
    name VARCHAR(100) NOT NULL COMMENT '活体名称',
    price DECIMAL(10,2) NOT NULL COMMENT '领养价格',
    monthly_feed_fee DECIMAL(10,2) NOT NULL COMMENT '月饲料费',
    redemption_months INT DEFAULT 12 COMMENT '买断所需月数',
    description TEXT NULL COMMENT '描述',
    images JSON NULL COMMENT '图片列表',
    main_image VARCHAR(500) NULL COMMENT '主图',
    stock INT DEFAULT 0 COMMENT '库存数量',
    sold_count INT DEFAULT 0 COMMENT '已售数量',
    status TINYINT DEFAULT 1 COMMENT '状态：1上架 2下架',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    deleted_at DATETIME(6) NULL COMMENT '软删除时间',
    PRIMARY KEY (id),
    INDEX IDX_livestock_no (livestock_no),
    INDEX IDX_livestock_type_id (type_id),
    CONSTRAINT FK_livestock_type FOREIGN KEY (type_id) REFERENCES livestock_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活体表';

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) NOT NULL COMMENT '订单ID',
    order_no VARCHAR(32) NOT NULL COMMENT '订单编号',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    livestock_id VARCHAR(32) NOT NULL COMMENT '活体ID',
    livestock_snapshot JSON NOT NULL COMMENT '活体快照',
    quantity INT DEFAULT 1 COMMENT '数量',
    total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
    paid_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '实付金额',
    payment_method VARCHAR(20) NULL COMMENT '支付方式',
    payment_no VARCHAR(64) NULL COMMENT '支付平台订单号',
    paid_at DATETIME NULL COMMENT '支付时间',
    status TINYINT DEFAULT 1 COMMENT '状态：1待支付 2已支付 3已取消 4已退款 5退款审核中 6退款处理中 7退款失败 8管理员强制取消',
    expire_at DATETIME NULL COMMENT '过期时间',
    cancel_reason VARCHAR(255) NULL COMMENT '取消原因',
    canceled_at DATETIME NULL COMMENT '取消时间',
    client_order_id VARCHAR(64) NULL COMMENT '客户端幂等键',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    version INT DEFAULT 1 COMMENT '乐观锁版本号',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_orders_order_no (order_no),
    INDEX IDX_orders_user_id (user_id),
    INDEX IDX_orders_livestock_id (livestock_id),
    INDEX IDX_orders_status (status),
    CONSTRAINT FK_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_orders_livestock FOREIGN KEY (livestock_id) REFERENCES livestock(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 订单历史记录表
CREATE TABLE IF NOT EXISTS order_history (
    id VARCHAR(32) NOT NULL COMMENT '历史记录ID',
    order_id VARCHAR(32) NOT NULL COMMENT '订单ID',
    from_status TINYINT NULL COMMENT '变更前状态',
    to_status TINYINT NOT NULL COMMENT '变更后状态',
    operator_id VARCHAR(32) NULL COMMENT '操作人ID',
    operator_type VARCHAR(20) NOT NULL COMMENT '操作人类型: user/admin/system',
    remark VARCHAR(500) NULL COMMENT '变更原因/备注',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX IDX_order_history_order_id (order_id),
    INDEX IDX_order_history_created_at (created_at),
    CONSTRAINT FK_order_history_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单历史记录表';

-- 领养记录表
CREATE TABLE IF NOT EXISTS adoptions (
    id VARCHAR(32) NOT NULL COMMENT '领养ID',
    adoption_no VARCHAR(32) NOT NULL COMMENT '领养编号',
    order_id VARCHAR(32) NOT NULL COMMENT '订单ID',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    livestock_id VARCHAR(32) NOT NULL COMMENT '活体ID',
    livestock_snapshot JSON NOT NULL COMMENT '活体快照',
    start_date DATE NOT NULL COMMENT '领养开始日期',
    redemption_months INT NOT NULL COMMENT '买断所需月数',
    feed_months_paid INT DEFAULT 0 COMMENT '已缴纳饲料费月数',
    total_feed_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计已缴饲料费',
    late_fee_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计滞纳金',
    status TINYINT DEFAULT 1 COMMENT '状态：1领养中 2饲料费逾期 3异常 4可买断 5买断审核中 6已买断 7已终止',
    current_feed_bill_id VARCHAR(64) NULL COMMENT '当前饲料费账单ID',
    is_exception TINYINT DEFAULT 0 COMMENT '是否异常：0否 1是',
    exception_reason VARCHAR(255) NULL COMMENT '异常原因',
    exception_at DATETIME NULL COMMENT '异常标记时间',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_adoptions_adoption_no (adoption_no),
    INDEX IDX_adoptions_order_id (order_id),
    INDEX IDX_adoptions_user_id (user_id),
    INDEX IDX_adoptions_livestock_id (livestock_id),
    INDEX IDX_adoptions_status (status),
    CONSTRAINT FK_adoptions_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT FK_adoptions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_adoptions_livestock FOREIGN KEY (livestock_id) REFERENCES livestock(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领养记录表';

-- 饲料费账单表
CREATE TABLE IF NOT EXISTS feed_bills (
    id VARCHAR(32) NOT NULL COMMENT '饲料账单ID',
    bill_no VARCHAR(32) NOT NULL COMMENT '账单编号',
    adoption_id VARCHAR(32) NOT NULL COMMENT '领养记录ID',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    livestock_id VARCHAR(32) NOT NULL COMMENT '活体ID',
    bill_month VARCHAR(7) NOT NULL COMMENT '账单月份：2026-04',
    bill_date DATE NOT NULL COMMENT '账单日期',
    original_amount DECIMAL(10,2) NOT NULL COMMENT '原金额',
    adjusted_amount DECIMAL(10,2) NULL COMMENT '调整后金额',
    final_amount DECIMAL(10,2) NOT NULL COMMENT '最终金额',
    late_fee_rate DECIMAL(5,4) NULL COMMENT '滞纳金比例（日）',
    late_fee_cap DECIMAL(10,2) NULL COMMENT '滞纳金上限',
    late_fee_days INT DEFAULT 0 COMMENT '逾期天数',
    late_fee_amount DECIMAL(10,2) DEFAULT 0 COMMENT '滞纳金金额',
    total_late_fee DECIMAL(10,2) DEFAULT 0 COMMENT '累计滞纳金',
    late_fee_start_date DATE NULL COMMENT '滞纳金开始计算日期',
    adjust_reason VARCHAR(255) NULL COMMENT '调整原因',
    due_date DATE NOT NULL COMMENT '应缴日期',
    paid_amount DECIMAL(10,2) DEFAULT 0 COMMENT '实付金额',
    payment_method VARCHAR(20) NULL COMMENT '支付方式',
    payment_no VARCHAR(64) NULL COMMENT '支付平台订单号',
    paid_at DATETIME NULL COMMENT '支付时间',
    expire_at DATETIME NULL COMMENT '过期时间',
    operator_id VARCHAR(32) NULL COMMENT '操作管理员ID',
    status TINYINT DEFAULT 1 COMMENT '状态：1待支付 2已支付 3已逾期 4已免除',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    version INT DEFAULT 1 COMMENT '乐观锁版本号',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_feed_bills_bill_no (bill_no),
    INDEX IDX_feed_bills_adoption_id (adoption_id),
    INDEX IDX_feed_bills_user_id (user_id),
    INDEX IDX_feed_bills_livestock_id (livestock_id),
    INDEX IDX_feed_bills_bill_month (bill_month),
    INDEX IDX_feed_bills_status (status),
    CONSTRAINT FK_feed_bills_adoption FOREIGN KEY (adoption_id) REFERENCES adoptions(id),
    CONSTRAINT FK_feed_bills_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_feed_bills_livestock FOREIGN KEY (livestock_id) REFERENCES livestock(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='饲料费账单表';

-- 买断订单表
CREATE TABLE IF NOT EXISTS redemption_orders (
    id VARCHAR(32) NOT NULL COMMENT '买断订单ID',
    redemption_no VARCHAR(32) NOT NULL COMMENT '买断编号',
    adoption_id VARCHAR(32) NOT NULL COMMENT '领养记录ID',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    livestock_id VARCHAR(32) NOT NULL COMMENT '活体ID',
    type TINYINT NOT NULL COMMENT '类型：1满期买断 2提前买断',
    original_amount DECIMAL(10,2) NOT NULL COMMENT '原买断金额',
    adjusted_amount DECIMAL(10,2) NULL COMMENT '调整后金额',
    final_amount DECIMAL(10,2) NOT NULL COMMENT '最终买断金额',
    adjust_reason VARCHAR(255) NULL COMMENT '调整原因',
    audit_admin_id VARCHAR(32) NULL COMMENT '审核管理员ID',
    audit_at DATETIME NULL COMMENT '审核时间',
    audit_remark VARCHAR(255) NULL COMMENT '审核备注',
    status TINYINT DEFAULT 1 COMMENT '状态：1待审核 2审核通过 3审核拒绝 4已支付 5已取消',
    paid_amount DECIMAL(10,2) DEFAULT 0 COMMENT '实付金额',
    payment_method VARCHAR(20) NULL COMMENT '支付方式',
    payment_no VARCHAR(64) NULL COMMENT '支付平台订单号',
    paid_at DATETIME NULL COMMENT '支付时间',
    expire_at DATETIME NULL COMMENT '过期时间',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_redemption_no (redemption_no),
    INDEX IDX_redemption_adoption_id (adoption_id),
    INDEX IDX_redemption_user_id (user_id),
    INDEX IDX_redemption_livestock_id (livestock_id),
    INDEX IDX_redemption_status (status),
    CONSTRAINT FK_redemption_adoption FOREIGN KEY (adoption_id) REFERENCES adoptions(id),
    CONSTRAINT FK_redemption_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT FK_redemption_livestock FOREIGN KEY (livestock_id) REFERENCES livestock(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='买断订单表';

-- 支付记录表
CREATE TABLE IF NOT EXISTS payment_records (
    id VARCHAR(32) NOT NULL COMMENT '支付记录ID',
    payment_no VARCHAR(64) NOT NULL COMMENT '支付平台订单号',
    out_trade_no VARCHAR(32) NULL COMMENT '商户订单号',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    order_type VARCHAR(20) NOT NULL COMMENT '订单类型：adoption/feed/redemption/recharge',
    order_id VARCHAR(32) NOT NULL COMMENT '订单ID',
    amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
    payment_method VARCHAR(20) NOT NULL COMMENT '支付方式：alipay/wechat/balance',
    status TINYINT DEFAULT 1 COMMENT '状态：1待支付 2支付成功 3支付失败 4已关闭',
    paid_at DATETIME NULL COMMENT '支付时间',
    notify_at DATETIME NULL COMMENT '回调时间',
    notify_data JSON NULL COMMENT '回调数据',
    transaction_id VARCHAR(64) NULL COMMENT '第三方交易ID',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    version INT DEFAULT 1 COMMENT '乐观锁版本号',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_payment_no (payment_no),
    INDEX IDX_payment_out_trade_no (out_trade_no),
    INDEX IDX_payment_user_id (user_id),
    INDEX IDX_payment_status (status),
    CONSTRAINT FK_payment_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付记录表';

-- 退款订单表
CREATE TABLE IF NOT EXISTS refund_orders (
    id VARCHAR(32) NOT NULL COMMENT '退款订单ID',
    refund_no VARCHAR(32) NOT NULL COMMENT '退款编号',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    order_type VARCHAR(20) NOT NULL COMMENT '订单类型：adoption/feed/redemption',
    order_id VARCHAR(32) NOT NULL COMMENT '原订单ID',
    original_amount DECIMAL(10,2) NOT NULL COMMENT '原订单金额',
    refund_amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
    refund_livestock TINYINT DEFAULT 2 COMMENT '是否退活体：1是 2否',
    reason VARCHAR(255) NULL COMMENT '退款原因',
    type TINYINT NOT NULL COMMENT '类型：1用户申请 2管理员操作 3系统自动',
    audit_admin_id VARCHAR(32) NULL COMMENT '审核管理员ID',
    audit_at DATETIME NULL COMMENT '审核时间',
    audit_remark VARCHAR(255) NULL COMMENT '审核备注',
    operator_id VARCHAR(32) NULL COMMENT '操作管理员ID',
    refund_method VARCHAR(20) NULL COMMENT '退款方式',
    status TINYINT DEFAULT 1 COMMENT '状态：1待审核 2审核通过 3审核拒绝 4已退款 5已取消',
    refund_at DATETIME NULL COMMENT '退款完成时间',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_refund_no (refund_no),
    INDEX IDX_refund_user_id (user_id),
    INDEX IDX_refund_order_id (order_id),
    INDEX IDX_refund_status (status),
    CONSTRAINT FK_refund_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='退款订单表';

-- 余额日志表
CREATE TABLE IF NOT EXISTS balance_logs (
    id VARCHAR(32) NOT NULL COMMENT '余额日志ID',
    user_id VARCHAR(32) NOT NULL COMMENT '用户ID',
    type TINYINT NOT NULL COMMENT '类型：1充值 2消费 3退款 4调整',
    amount DECIMAL(10,2) NOT NULL COMMENT '变动金额',
    balance_before DECIMAL(10,2) NOT NULL COMMENT '变动前余额',
    balance_after DECIMAL(10,2) NOT NULL COMMENT '变动后余额',
    related_type VARCHAR(20) NULL COMMENT '关联类型',
    related_id VARCHAR(64) NULL COMMENT '关联ID',
    remark VARCHAR(255) NULL COMMENT '备注',
    operator_id VARCHAR(32) NULL COMMENT '操作管理员ID',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX IDX_balance_user_id (user_id),
    CONSTRAINT FK_balance_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='余额日志表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id VARCHAR(32) NOT NULL COMMENT '配置ID',
    config_key VARCHAR(50) NOT NULL COMMENT '配置键',
    config_value TEXT NULL COMMENT '配置值',
    config_type VARCHAR(20) DEFAULT 'basic' COMMENT '配置类型',
    description VARCHAR(255) NULL COMMENT '描述',
    is_encrypted TINYINT DEFAULT 0 COMMENT '是否加密：0否 1是',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX IDX_system_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(32) NOT NULL COMMENT '通知ID',
    user_id VARCHAR(32) NULL COMMENT '用户ID（为空则全员）',
    title VARCHAR(100) NOT NULL COMMENT '标题',
    content TEXT NOT NULL COMMENT '内容',
    type VARCHAR(20) NOT NULL COMMENT '类型：system/order/feed/redemption/balance',
    related_type VARCHAR(20) NULL COMMENT '关联类型',
    related_id VARCHAR(64) NULL COMMENT '关联ID',
    is_read TINYINT DEFAULT 0 COMMENT '是否已读：0否 1是',
    read_at DATETIME NULL COMMENT '阅读时间',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX IDX_notifications_user_id (user_id),
    INDEX IDX_notifications_is_read (is_read),
    INDEX IDX_notifications_user_is_read (user_id, is_read),
    INDEX IDX_notifications_user_created_at (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(32) NOT NULL COMMENT '日志ID',
    admin_id VARCHAR(32) NULL COMMENT '管理员ID',
    admin_name VARCHAR(50) NULL COMMENT '管理员用户名',
    module VARCHAR(50) NULL COMMENT '模块',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    target_type VARCHAR(50) NULL COMMENT '目标类型',
    target_id VARCHAR(32) NULL COMMENT '目标ID',
    before_data JSON NULL COMMENT '操作前数据',
    after_data JSON NULL COMMENT '操作后数据',
    remark VARCHAR(500) NULL COMMENT '备注',
    ip VARCHAR(45) NULL COMMENT 'IP地址',
    user_agent VARCHAR(500) NULL COMMENT '用户代理',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX IDX_audit_admin_id (admin_id),
    INDEX IDX_audit_action (action),
    INDEX IDX_audit_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志表';

-- 短信验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
    id VARCHAR(32) NOT NULL COMMENT 'ID',
    phone VARCHAR(11) NOT NULL COMMENT '手机号',
    code VARCHAR(6) NOT NULL COMMENT '验证码',
    type VARCHAR(20) NOT NULL COMMENT '类型：register/login/reset_password',
    is_used TINYINT DEFAULT 0 COMMENT '是否已使用：0否 1是',
    expire_at DATETIME NOT NULL COMMENT '过期时间',
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
    PRIMARY KEY (id),
    INDEX IDX_sms_phone (phone),
    INDEX IDX_sms_phone_code (phone, code),
    INDEX IDX_sms_phone_type_isused (phone, type, is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码表';

-- 插入默认活体类型
INSERT IGNORE INTO livestock_types (id, name, icon, description, sort_order, status, created_at, updated_at) VALUES
('LT001', '山羊', 'goat', '温顺可爱的山羊', 1, 1, NOW(), NOW()),
('LT002', '绵羊', 'sheep', '毛茸茸的绵羊', 2, 1, NOW(), NOW()),
('LT003', '黄牛', 'cattle', '强壮的黄牛', 3, 1, NOW(), NOW()),
('LT004', '水牛', 'buffalo', '勤劳的水牛', 4, 1, NOW(), NOW());

-- 安全修复 INFRA-003：创建专用应用数据库用户（最小权限原则）
-- 注意：密码需要通过环境变量 APP_DB_PASSWORD 设置
-- 如果未设置密码，用户创建会失败，应用将无法连接数据库
-- 创建用户语句使用 IF NOT EXISTS 防止重复执行报错

-- 检查是否需要创建应用用户（仅在设置了 APP_DB_PASSWORD 时创建）
-- 注意：MySQL 不支持在 CREATE USER 中使用变量，以下语句需要手动启用或在启动脚本中处理
-- SET @app_password = IFNULL(@APP_DB_PASSWORD, '');
-- SET @create_user = IF(@app_password != '', CONCAT('CREATE USER IF NOT EXISTS ''cloud_ranch_app''@''%'' IDENTIFIED BY ''', @app_password, ''''), '');
-- PREPARE stmt FROM @create_user;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- 授权语句（需要手动执行或在docker-compose中配置）
-- GRANT SELECT, INSERT, UPDATE, DELETE ON cloud_ranch.* TO 'cloud_ranch_app'@'%';
-- FLUSH PRIVILEGES;

-- 实际部署时，请在 docker-compose.yml 中配置：
-- environment:
--   DB_USERNAME: cloud_ranch_app
--   DB_PASSWORD: ${APP_DB_PASSWORD}
-- 并在首次启动后手动执行授权语句，或使用 secrets 管理

-- ============================================================================
-- 性能优化索引（2026-04-25）
-- 注意：MySQL不支持 IF NOT EXISTS，全新部署时自动创建
-- ============================================================================

-- 订单表
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- 领养表（IDX_adoptions_order_id 已在表定义中，这里只添加复合索引）
CREATE INDEX idx_adoptions_user_status ON adoptions(user_id, status);

-- 退款订单表
CREATE INDEX idx_refund_orders_order_status ON refund_orders(order_id, status);
CREATE INDEX idx_refund_orders_user_status ON refund_orders(user_id, status);

-- 余额变动记录表
CREATE INDEX idx_balance_logs_user_created ON balance_logs(user_id, created_at);

-- 支付记录表
CREATE INDEX idx_payment_records_order ON payment_records(order_type, order_id);
CREATE INDEX idx_payment_records_user ON payment_records(user_id, created_at);

-- 买断订单表
CREATE INDEX idx_redemption_orders_user_status ON redemption_orders(user_id, status);
CREATE INDEX idx_redemption_orders_adoption ON redemption_orders(adoption_id, status);

-- 饲料费账单表
CREATE INDEX idx_feed_bills_user_status ON feed_bills(user_id, status);
CREATE INDEX idx_feed_bills_adoption ON feed_bills(adoption_id, status);

-- 通知表
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at);

-- 审计日志表
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id, created_at);
CREATE INDEX idx_audit_logs_module ON audit_logs(module, created_at);
