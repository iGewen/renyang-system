# 云端牧场项目上下文信息

> 此文档保存项目关键信息，避免上下文压缩后丢失。每次会话开始时请先阅读此文档。

## 服务器信息

### 生产服务器
- **IP地址**: 82.156.218.187
- **用户名**: root
- **密码**: Hehaifeng520@
- **SSH端口**: 22
- **项目路径**: /var/www/wwwroot/renyang-system
- **部署方式**: Docker Compose

### 部署命令
```bash
# SSH连接（使用Python paramiko库）
# Windows环境下使用以下Python脚本连接：
python -c "
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('82.156.218.187', username='root', password='Hehaifeng520@')
channel = ssh.invoke_shell()
# 执行命令...
"

# 或者手动SSH登录
ssh root@82.156.218.187
# 密码: Hehaifeng520@

# 进入项目目录
cd /var/www/wwwroot/renyang-system

# 拉取代码
git pull origin dev

# 重启服务
docker compose restart backend frontend
# 或完全重建
docker compose up -d --build

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 服务端口
| 服务 | 端口 | 说明 |
|------|------|------|
| frontend | 80 | Nginx前端 |
| backend | 3001 | NestJS API |
| mysql | 3306 | MySQL数据库 |
| redis | 6379 | Redis缓存 |

### 访问地址
- 前端页面: http://82.156.218.187
- API文档: http://82.156.218.187:3001/api/docs
- 管理后台: http://82.156.218.187/admin

### 默认账号
- 管理员: admin / admin123456

---

## Git仓库信息

- **仓库地址**: https://github.com/iGewen/renyang-system.git
- **主分支**: dev
- **当前commit**: a5fa9d9 (fix: 修复多项问题)

---

## 项目技术栈

### 后端
- NestJS 10
- MySQL 8.0 + TypeORM
- Redis
- JWT + Passport 认证
- Swagger API文档
- 定时任务 @nestjs/schedule

### 前端
- React 18
- Vite
- Tailwind CSS
- React Router v6

---

## 数据库实体 (已实现)

| 实体 | 文件 | 说明 |
|------|------|------|
| Admin | admin.entity.ts | 管理员 |
| User | user.entity.ts | 用户 |
| Livestock | livestock.entity.ts | 活体 |
| LivestockType | livestock-type.entity.ts | 活体类型 |
| Order | order.entity.ts | 订单 |
| Adoption | adoption.entity.ts | 领养记录 |
| FeedBill | feed-bill.entity.ts | 饲料费账单 |
| RedemptionOrder | redemption-order.entity.ts | 买断订单 |
| RefundOrder | refund-order.entity.ts | 退款订单 |
| PaymentRecord | payment-record.entity.ts | 支付记录 |
| BalanceLog | balance-log.entity.ts | 余额日志 |
| Notification | notification.entity.ts | 通知 |
| SystemConfig | system-config.entity.ts | 系统配置 |
| SmsCode | sms-code.entity.ts | 短信验证码 |
| AuditLog | audit-log.entity.ts | 审计日志 |

---

## 后端模块 (已实现)

| 模块 | 目录 | 说明 |
|------|------|------|
| Auth | modules/auth | 认证登录 |
| User | modules/user | 用户管理 |
| Admin | modules/admin | 管理后台 |
| Livestock | modules/livestock | 活体管理 |
| Order | modules/order | 订单管理 |
| Adoption | modules/adoption | 领养管理 |
| Feed | modules/feed | 饲料费管理 |
| Redemption | modules/redemption | 买断管理 |
| Refund | modules/refund | 退款管理 |
| Payment | modules/payment | 支付管理 |
| Balance | modules/balance | 余额管理 |
| Notification | modules/notification | 通知管理 |
| Upload | modules/upload | 文件上传 |

---

## 第三方服务

### 支付服务
- **支付宝H5支付**: alipay.service.ts
- **微信H5支付**: wechat-pay.service.ts

### 短信服务
- 阿里云短信

---

## 最近修复记录

### 2026-04-04 (commit: a5fa9d9)
1. **数据库字符集修复** - 解决中文乱码问题
2. **仪表盘SQL错误** - 修复 amount → paidAmount
3. **导航栏优化** - 移除底部站内信图标，保留3个按钮
4. **站内信管理** - 后台添加站内信发送功能
5. **支付配置完善** - 支付宝和微信H5支付完整配置项

---

## 待实现功能检查清单

### 用户端功能 (已全部实现)
- [x] 手机号登录/注册 (auth.controller.ts)
- [x] 微信登录 (框架已有，需配置appId)
- [x] 活体浏览 (livestock.controller.ts)
- [x] 活体领养 (adoption.controller.ts)
- [x] 饲料费缴纳 (feed.controller.ts)
- [x] 买断赎回 (redemption.controller.ts)
- [x] 余额充值 (balance.controller.ts)
- [x] 订单管理 (order.controller.ts)
- [x] 通知中心 (notification.controller.ts)
- [x] 个人中心 (auth.controller.ts)

### 管理端功能 (已全部实现)
- [x] 仪表盘统计 (admin.controller.ts)
- [x] 用户管理
- [x] 活体类型管理
- [x] 活体管理
- [x] 订单管理
- [x] 领养管理
- [x] 饲料费管理
- [x] 退款管理
- [x] 系统配置
- [x] 站内信发送
- [x] 管理员管理
- [x] 审计日志

### 支付功能 (已全部实现)
- [x] 支付宝H5支付 (alipay.service.ts)
- [x] 微信H5支付 (wechat-pay.service.ts)
- [x] 支付回调处理 (payment.controller.ts)
- [x] 退款处理 (refund.controller.ts)

### 定时任务 (已全部实现)
- [x] 每天凌晨1点生成饲料费账单 (tasks.service.ts)
- [x] 每天凌晨2点计算滞纳金
- [x] 每5分钟检查过期订单
- [x] 每天凌晨3点检查领养状态
- [x] 每小时清理过期数据

### 短信服务
- [x] 验证码生成和存储 (auth.service.ts)
- [ ] 阿里云短信实际发送 (TODO: 需配置阿里云短信)

---

## 重要提示

1. **SSH连接**: 
   - IP: 82.156.218.187
   - 用户: root
   - 密码: Hehaifeng520@

2. **数据库字符集**: 已配置utf8mb4，注意:
   - 连接字符集
   - 表字符集
   - 已有数据修复

3. **支付配置**: 需要在后台系统配置中设置:
   - 支付宝: app_id, private_key, public_key, notify_url, return_url
   - 微信: app_id, mch_id, pay_key, api_v3_key, serial_no, private_key, notify_url

---

## 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-04-04 | 创建上下文文档，记录服务器信息和功能清单 |
