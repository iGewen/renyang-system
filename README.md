# 云端牧场 - Cloud Ranch

一个基于 NestJS + React 的云端牧场管理系统，支持活体领养、饲料订阅、买断赎回等功能。

## 项目结构

```
renyang-system/
├── backend/          # NestJS 后端
│   ├── src/
│   │   ├── common/   # 公共模块（守卫、装饰器、工具类）
│   │   ├── config/   # 配置文件
│   │   ├── entities/ # 数据库实体
│   │   ├── modules/  # 业务模块
│   │   ├── services/ # 第三方服务
│   │   └── tasks/    # 定时任务
│   ├── test/         # 测试文件
│   └── scripts/      # 脚本文件
└── frontend/         # React 前端（待开发）
```

## 技术栈

### 后端
- **框架**: NestJS 10
- **数据库**: MySQL + TypeORM
- **缓存**: Redis
- **认证**: JWT + Passport
- **API文档**: Swagger
- **定时任务**: @nestjs/schedule

### 前端
- **框架**: React 18
- **构建**: Vite
- **UI**: 自定义组件库
- **状态管理**: React Hooks

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
- 🐄 活体类型与管理
- 📦 订单管理
- 📝 领养记录管理
- 💰 饲料费管理
- 🔄 退款审核
- ⚙️ 系统配置

## 快速开始

### 环境要求
- Node.js >= 18
- MySQL >= 8.0
- Redis >= 6.0

### 后端安装

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和Redis连接信息

# 初始化数据库
mysql -u root -p < scripts/init-database.sql

# 启动开发服务器
npm run start:dev
```

### 前端安装

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 环境配置

### 后端环境变量 (.env)

```env
# 应用配置
NODE_ENV=development
PORT=3001

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=cloud_ranch

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# 支付配置
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
WECHAT_APP_ID=
WECHAT_MCH_ID=
```

## API文档

启动后端服务后访问：
- Swagger UI: http://localhost:3001/api/docs

## 数据库初始化

### 方式一：SQL脚本
```bash
mysql -u root -p < backend/scripts/init-database.sql
```

### 方式二：TypeScript脚本
```bash
cd backend
npm run db:init
```

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123456`

## 测试

```bash
# 运行单元测试
npm test

# 运行测试覆盖率
npm run test:cov

# 运行E2E测试
npm run test:e2e
```

## 部署

### 生产环境构建

```bash
# 后端
cd backend
npm run build
npm run start:prod

# 前端
cd frontend
npm run build
```

### Docker部署（待实现）

```bash
docker-compose up -d
```

## 项目进度

- [x] 后端基础架构
- [x] 用户认证模块
- [x] 活体管理模块
- [x] 订单系统
- [x] 领养管理
- [x] 饲料费管理
- [x] 买断系统
- [x] 退款系统
- [x] 支付集成
- [x] 管理后台API
- [x] Swagger文档
- [x] 日志系统
- [x] 文件上传
- [x] 单元测试
- [ ] 前端开发
- [ ] Docker部署

## 许可证

MIT License
