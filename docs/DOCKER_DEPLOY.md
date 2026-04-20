# Docker 部署教程 - 一键部署

本文档介绍如何使用 Docker Compose 一键部署云端牧场项目。

> **兼容性说明：** 本项目同时支持 Docker Compose V1 和 V2 命令格式。
> - 新版命令：`docker compose`（Docker Compose V2，推荐）
> - 旧版命令：`docker-compose`（Docker Compose V1）

## 目录

- [环境准备](#环境准备)
- [一键部署](#一键部署)
- [配置说明](#配置说明)
- [常用命令](#常用命令)
- [故障排查](#故障排查)

---

## 环境准备

### 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| 操作系统 | CentOS 7+ / Ubuntu 18.04+ | CentOS 7.9 |
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 磁盘 | 40GB | 100GB+ |

### 安装 Docker（包含 Docker Compose V2）

**推荐方式（自动安装最新版）：**
```bash
# 安装Docker（包含Docker Compose V2）
curl -fsSL https://get.docker.com | bash

# 启动Docker
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

**CentOS 手动安装：**
```bash
# 安装必要工具
yum install -y yum-utils device-mapper-persistent-data lvm2

# 添加Docker源（阿里云镜像）
yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

# 安装Docker（包含Docker Compose插件）
yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动Docker
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

**Ubuntu 手动安装：**
```bash
# 更新包索引
apt-get update

# 安装依赖
apt-get install -y ca-certificates curl gnupg lsb-release

# 添加Docker源
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装Docker（包含Docker Compose插件）
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动Docker
systemctl start docker
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 配置Docker镜像加速（推荐）

国内服务器建议配置镜像加速，提高镜像拉取速度：

```bash
# 创建Docker配置目录
sudo mkdir -p /etc/docker

# 配置镜像加速
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://docker.nju.edu.cn"
  ]
}
EOF

# 重启Docker服务
sudo systemctl daemon-reload
sudo systemctl restart docker

# 验证配置
docker info | grep -A 5 "Registry Mirrors"
```

### 安装 Docker Compose V1（可选）

如果您的系统没有 Docker Compose V2，可以安装 V1：

```bash
# 下载Docker Compose V1
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

---

## 一键部署

### 步骤一：创建目录并获取代码

```bash
# 创建项目目录
sudo mkdir -p /var/www/wwwroot
cd /var/www/wwwroot

# 克隆代码（指定dev分支）
git clone -b dev https://github.com/iGewen/renyang-system.git

# 设置目录权限
sudo chown -R $USER:$USER /var/www/wwwroot/renyang-system

# 进入项目目录
cd renyang-system
```

### 步骤二：配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑配置（必须修改以下两项！）
vim .env
```

**必须修改的配置：**
```env
# MySQL密码（设置一个强密码）
MYSQL_ROOT_PASSWORD=YourStrongPassword123!

# JWT密钥（设置一个复杂的随机字符串，至少32位）
JWT_SECRET=your-very-long-and-secure-jwt-secret-key-at-least-32-characters
```

### 步骤三：一键启动

```bash
# 新版Docker命令（Docker Compose V2，推荐）
docker compose up -d

# 或使用旧版命令（Docker Compose V1，兼容）
docker-compose up -d
```

Docker Compose 会自动完成：
1. ✅ 拉取 MySQL 8.0 镜像（阿里云ACR）
2. ✅ 拉取 Redis 镜像（阿里云ACR）
3. ✅ 构建后端 NestJS 镜像（使用国内镜像源加速）
4. ✅ 构建前端 React + Nginx 镜像（使用国内镜像源加速）
5. ✅ 初始化数据库和表结构
6. ✅ 启动所有服务并进行健康检查

### 步骤四：验证部署

```bash
# 新版命令
docker compose ps

# 旧版命令
docker-compose ps

# 应该看到所有服务状态为 healthy
# NAME                    STATUS
# cloud-ranch-mysql       running (healthy)
# cloud-ranch-redis       running (healthy)
# cloud-ranch-backend     running (healthy)
# cloud-ranch-frontend    running (healthy)
```

### 步骤五：访问应用

- **前端页面**: http://服务器IP
- **后端API文档**: http://服务器IP:3001/api/docs
- **管理后台**: http://服务器IP/admin

**默认管理员账号：**
- 用户名: `admin`
- 密码: `admin123456`

⚠️ **重要：首次登录后请立即修改默认密码！**

---

## 配置说明

### 环境变量完整说明

```env
# ==================== 基础配置 ====================

# MySQL root密码（必须修改！）
MYSQL_ROOT_PASSWORD=your_strong_password_here

# MySQL端口（可选，默认3306）
MYSQL_PORT=3306

# Redis端口（可选，默认6379）
REDIS_PORT=6379

# 后端服务端口（可选，默认3001）
BACKEND_PORT=3001

# 前端服务端口（可选，默认80）
FRONTEND_PORT=80

# ==================== 安全配置 ====================

# JWT密钥（必须修改为复杂的随机字符串）
JWT_SECRET=your-jwt-secret-key

# ==================== 支付配置（可选） ====================

# 支付宝
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=

# 微信支付
WECHAT_APP_ID=
WECHAT_MCH_ID=
WECHAT_PAY_KEY=

# ==================== 短信配置（可选） ====================

ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
```

### 端口说明

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| frontend | 80 | 前端Nginx服务 |
| backend | 3001 | 后端API服务 |
| mysql | 3306 | MySQL数据库 |
| redis | 6379 | Redis缓存 |

---

## 常用命令

> **提示：** 以下命令同时提供 V1 和 V2 两种格式，根据您的环境选择使用。

### 服务管理

```bash
# 启动服务
docker compose up -d        # V2 新版
docker-compose up -d        # V1 旧版

# 停止服务
docker compose down         # V2 新版
docker-compose down         # V1 旧版

# 重启服务
docker compose restart      # V2 新版
docker-compose restart      # V1 旧版

# 重启单个服务
docker compose restart backend
docker-compose restart backend

# 查看状态
docker compose ps
docker-compose ps

# 查看资源使用
docker stats
```

### 日志查看

```bash
# 查看所有日志
docker compose logs -f
docker-compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker-compose logs -f backend

# 查看最近100行
docker compose logs --tail=100 backend
docker-compose logs --tail=100 backend
```

### 更新部署

```bash
# 进入项目目录
cd /var/www/wwwroot/renyang-system

# 拉取最新代码
git pull

# 重新构建并启动（推荐）
docker compose up -d --build
docker-compose up -d --build

# 强制重新构建（解决构建问题时使用）
docker compose build --no-cache
docker compose up -d

# 只重建后端
docker compose up -d --build backend
docker-compose up -d --build backend

# 只重建前端
docker compose up -d --build frontend
docker-compose up -d --build frontend
```

### 数据库操作

```bash
# 进入MySQL
docker compose exec mysql mysql -u root -p
docker-compose exec mysql mysql -u root -p

# 备份数据库
docker compose exec mysql mysqldump -u root -p cloud_ranch > backup.sql
docker-compose exec mysql mysqldump -u root -p cloud_ranch > backup.sql

# 恢复数据库
docker compose exec -T mysql mysql -u root -p cloud_ranch < backup.sql
docker-compose exec -T mysql mysql -u root -p cloud_ranch < backup.sql
```

---

## 故障排查

### 查看服务状态

```bash
# 查看所有容器状态
docker compose ps
docker-compose ps

# 查看不健康的容器
docker compose ps --filter "health=unhealthy"
```

### 查看日志

```bash
# 查看后端日志
docker compose logs -f backend
docker-compose logs -f backend

# 查看MySQL日志
docker compose logs -f mysql
docker-compose logs -f mysql

# 查看前端日志
docker compose logs -f frontend
docker-compose logs -f frontend
```

### 常见问题

**1. npm依赖冲突（ERESOLVE错误）**
```bash
# 问题表现：
# npm error ERESOLVE could not resolve

# 解决方案：已内置 --legacy-peer-deps 参数
# 如仍遇到问题，可手动重新构建
docker compose build --no-cache backend
docker compose up -d
```

**2. 镜像拉取缓慢**
```bash
# 配置Docker镜像加速（见上文"配置Docker镜像加速"）
# 或使用阿里云ACR镜像
```

**3. MySQL启动失败**
```bash
# 检查日志
docker compose logs mysql
docker-compose logs mysql

# 可能是权限问题
sudo chown -R 999:999 /var/lib/docker/volumes/renyang-system_mysql_data

# 或删除数据卷重新初始化（会清空数据）
docker compose down -v
docker compose up -d
```

**4. 后端无法连接数据库**
```bash
# 等待MySQL完全启动（约30-60秒）
docker compose ps mysql

# 检查MySQL健康状态
docker compose logs mysql | grep "ready for connections"

# 重启后端服务
docker compose restart backend
```

**5. 前端无法访问后端API**
```bash
# 检查后端是否健康
docker compose ps backend
docker-compose ps backend

# 检查Nginx配置
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# 检查网络连通性
docker compose exec frontend ping backend
```

**6. 端口被占用**
```bash
# 查看端口占用
netstat -tlnp | grep :80
netstat -tlnp | grep :3001
netstat -tlnp | grep :3306

# 修改.env中的端口配置
FRONTEND_PORT=8080
BACKEND_PORT=3002
MYSQL_PORT=13306
```

### 重置环境

```bash
# 进入项目目录
cd /var/www/wwwroot/renyang-system

# 停止并删除容器和网络
docker compose down
docker-compose down

# 删除数据卷（会清空数据库！）
docker compose down -v
docker-compose down -v

# 重新部署
docker compose up -d
docker-compose up -d
```

---

## 安全建议

### 1. 修改默认密码

```bash
# 登录后立即修改管理员密码
# 后台 -> 系统设置 -> 管理员管理
```

### 2. 修改端口（可选）

编辑 `.env` 文件：
```env
FRONTEND_PORT=8080
BACKEND_PORT=3002
MYSQL_PORT=13306
```

### 3. 配置防火墙

```bash
# CentOS
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload

# Ubuntu
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 4. 启用HTTPS

推荐使用 Nginx 反向代理 + Let's Encrypt 证书：

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu
sudo yum install certbot python3-certbot-nginx  # CentOS

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 5. 定期备份

```bash
# 创建备份目录
sudo mkdir -p /var/backups/cloud-ranch

# 备份数据库
cd /var/www/wwwroot/renyang-system
docker compose exec mysql mysqldump -u root -p cloud_ranch > /var/backups/cloud-ranch/db_$(date +%Y%m%d).sql

# 设置定时备份（每天凌晨2点）
echo "0 2 * * * cd /var/www/wwwroot/renyang-system && docker compose exec -T mysql mysqldump -u root -p\${MYSQL_ROOT_PASSWORD} cloud_ranch > /var/backups/cloud-ranch/db_\$(date +\%Y\%m\%d).sql" | sudo crontab -
```

---

## 构建说明

本项目使用国内镜像源加速构建：

### Alpine镜像源
```dockerfile
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
```

### npm镜像源
```dockerfile
RUN npm config set registry https://registry.npmmirror.com && npm ci --legacy-peer-deps
```

### 使用的基础镜像

| 服务 | 镜像 | 来源 |
|------|------|------|
| MySQL | mysql:8.0 | 阿里云ACR |
| Redis | redis:latest | 阿里云ACR |
| 后端构建 | node:lts-alpine | Docker Hub |
| 前端构建 | node:lts-alpine | Docker Hub |
| 前端运行 | nginx:alpine | Docker Hub |

---

**文档版本**: v2.2
**更新日期**: 2026-04-04
