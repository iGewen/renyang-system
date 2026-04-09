# 云端牧场 - Cloud Ranch

一个基于 NestJS + React 的云端牧场管理系统，支持活体领养、饲料订阅、买断赎回等功能。

## 技术栈

| 类型 | 技术 |
|------|------|
| 后端框架 | NestJS 10 |
| 数据库 | MySQL 8.0 + TypeORM |
| 缓存 | Redis |
| 认证 | JWT + Passport |
| 前端框架 | React 18 + Vite |
| UI组件 | 自定义组件库 |
| 部署 | Docker Compose |

## 功能特性

### 用户端
- 📱 手机号/微信登录
- 🐐 活体浏览与领养
- 💰 余额充值与消费
- 📋 饲料费账单管理
- 🔔 消息通知
- 💳 支付宝/微信支付

### 管理端
- 📊 数据统计仪表盘
- 👥 用户管理
- 🐄 活体管理
- 📦 订单管理
- 💰 饲料费管理
- 🔄 买断审核
- 📝 协议管理
- ⚙️ 系统配置

## 快速部署

### 环境要求
- Docker & Docker Compose
- 服务器端口：80、443、3001

### 一键部署

```bash
# 1. 克隆代码
git clone -b dev https://github.com/iGewen/renyang-system.git
cd renyang-system

# 2. 配置环境变量
cp .env.docker .env
# 编辑 .env 文件，修改以下配置：
# - MYSQL_ROOT_PASSWORD（MySQL密码）
# - JWT_SECRET（JWT密钥，至少32位）
# - DOMAIN（域名，启用HTTPS）
# - EMAIL（证书申请邮箱）

# 3. 启动服务
docker compose up -d
```

### 启用HTTPS（推荐）

```bash
# 配置域名后使用HTTPS模式
docker compose -f docker-compose.https.yml up -d
```

HTTPS模式会自动：
- ✅ 申请Let's Encrypt SSL证书
- ✅ 配置Nginx HTTPS
- ✅ 证书到期自动续签

## 访问地址

| 服务 | 地址 |
|------|------|
| 用户端 | http://服务器IP |
| 管理后台 | http://服务器IP/admin |
| API文档 | http://服务器IP:3001/api/docs |

## 默认账号

- 管理员密码通过环境变量 `ADMIN_DEFAULT_PASSWORD` 设置
- 首次登录后强制修改密码
- 未设置则使用随机生成的密码（查看后端日志）

## 环境变量

主要配置项：

```env
# 域名配置（启用HTTPS必填）
DOMAIN=your-domain.com
EMAIL=your@email.com

# 数据库
MYSQL_ROOT_PASSWORD=your_strong_password

# 安全
JWT_SECRET=your-very-long-jwt-secret-key

# 支付配置（可选）
ALIPAY_APP_ID=
WECHAT_APP_ID=

# 短信配置（可选）
ALIYUN_SMS_ACCESS_KEY_ID=
```

## 本地开发

### 后端

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
renyang-system/
├── backend/                # NestJS 后端
│   ├── src/
│   │   ├── modules/        # 业务模块
│   │   ├── entities/       # 数据库实体
│   │   ├── common/         # 公共模块
│   │   └── config/         # 配置文件
│   └── scripts/            # 脚本
├── frontend/               # React 前端
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   ├── services/       # API服务
│   │   └── contexts/       # 状态管理
│   └── nginx.conf          # Nginx配置
├── nginx/                  # HTTPS配置脚本
├── docker-compose.yml      # HTTP模式部署
├── docker-compose.https.yml # HTTPS模式部署
└── .env.docker             # 环境变量模板
```

## 许可证

MIT License
