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
| UI 组件 | 自定义组件库 + Tailwind CSS |
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

| 要求 | 说明 |
|------|------|
| Docker | 20.10+ |
| Docker Compose | V2（推荐）或 V1 |
| 服务器端口 | 80、443、3001 |
| 内存 | 最低 4GB，推荐 8GB |

### 一键部署

```bash
# 1. 克隆代码
git clone -b dev https://github.com/iGewen/renyang-system.git
cd renyang-system

# 2. 配置环境变量
cp .env.docker .env
nano .env  # 编辑配置文件

# 3. 启动服务
docker compose up -d
```

### 启用 HTTPS（生产环境推荐）

```bash
# 配置 .env 中的域名和邮箱
DOMAIN=your-domain.com
EMAIL=your@email.com

# 启动 HTTPS 模式
docker compose -f docker-compose.https.yml up -d
```

HTTPS 模式会自动：
- ✅ 申请 Let's Encrypt SSL 证书
- ✅ 配置 Nginx HTTPS
- ✅ 证书到期自动续签

### 镜像说明

本项目使用阿里云 ACR 镜像仓库，国内服务器可直接拉取：

| 镜像 | 地址 |
|------|------|
| MySQL | `crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/mysql:8.0` |
| Redis | `crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/redis:latest` |

如遇拉取超时，请配置 Docker 镜像加速器：

```bash
# 编辑 /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com"
  ]
}

# 重启 Docker
systemctl restart docker
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 用户端 | `http://你的域名` 或 `http://服务器IP` |
| 管理后台 | `http://你的域名/admin` |
| API 文档 | `http://你的域名:3001/api/docs` |

## 默认账号

- 管理员密码通过环境变量 `ADMIN_DEFAULT_PASSWORD` 设置
- 首次登录后强制修改密码
- 未设置则使用随机生成的密码（查看后端日志获取）

## 环境变量配置

### 必须配置

```env
# 域名配置（启用 HTTPS 必填）
DOMAIN=your-domain.com
EMAIL=your@email.com

# 数据库密码（必须修改）
MYSQL_ROOT_PASSWORD=your_strong_password_here

# Redis 密码（必须修改）
REDIS_PASSWORD=your_redis_password_here

# JWT 密钥（至少 32 位随机字符串）
JWT_SECRET=your-very-long-jwt-secret-key-here

# 管理员默认密码
ADMIN_DEFAULT_PASSWORD=Admin@123456
```

### 可选配置

```env
# 支付配置
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
WECHAT_APP_ID=
WECHAT_MCH_ID=

# 短信配置
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
```

## 部署教程

详细的部署教程请参阅：

| 教程 | 文件 | 适用场景 |
|------|------|----------|
| 1Panel 部署 | [docs/DEPLOY_1PANEL_DOCKER.md](docs/DEPLOY_1PANEL_DOCKER.md) | Docker 容器化管理，推荐 |
| 宝塔面板部署 | [docs/DEPLOY_BT_DOCKER.md](docs/DEPLOY_BT_DOCKER.md) | 需要宝塔管理网站和数据库 |
| Docker 通用部署 | [docs/DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) | 通用 Docker 部署指南 |
| HTTPS 部署 | [docs/HTTPS_DEPLOYMENT.md](docs/HTTPS_DEPLOYMENT.md) | HTTPS 证书配置详解 |

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
├── backend/                    # NestJS 后端
│   ├── src/
│   │   ├── modules/            # 业务模块
│   │   │   ├── admin/          # 管理后台
│   │   │   ├── adoption/       # 领养模块
│   │   │   ├── order/          # 订单模块
│   │   │   ├── payment/        # 支付模块
│   │   │   ├── user/           # 用户模块
│   │   │   └── ...
│   │   ├── entities/           # 数据库实体
│   │   ├── common/             # 公共模块
│   │   │   ├── guards/         # 守卫
│   │   │   ├── filters/        # 过滤器
│   │   │   └── decorators/     # 装饰器
│   │   └── services/           # 服务层
│   ├── scripts/                # 脚本
│   └── Dockerfile
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   │   ├── admin/          # 管理后台页面
│   │   │   ├── adoption/       # 领养页面
│   │   │   ├── auth/           # 认证页面
│   │   │   └── ...
│   │   ├── components/         # 通用组件
│   │   ├── services/           # API 服务
│   │   ├── contexts/           # 状态管理
│   │   └── types/              # TypeScript 类型
│   ├── nginx.conf              # Nginx 配置
│   └── Dockerfile
├── nginx/                      # HTTPS 配置脚本
├── mysql/                      # MySQL 配置
├── docker-compose.yml          # HTTP 模式部署
├── docker-compose.https.yml    # HTTPS 模式部署
└── .env.docker                 # 环境变量模板
```

## 技术亮点

- 🔐 **安全设计**：JWT 认证、密码加密、SQL 注入防护
- 📱 **移动端适配**：响应式设计，支持手机端访问
- 💳 **多支付方式**：支付宝、微信支付、余额支付
- 🔄 **自动备份**：MySQL 数据库定时备份
- 📊 **监控日志**：完整的操作审计日志
- 🚀 **容器化部署**：Docker Compose 一键部署

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 [GitHub Issue](https://github.com/iGewen/renyang-system/issues)。
