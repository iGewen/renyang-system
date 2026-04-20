# 1Panel Docker 部署教程

本文档详细介绍如何使用 1Panel 面板 + Docker 部署云端牧场系统。

## 目录

1. [环境准备](#1-环境准备)
2. [安装 1Panel](#2-安装-1panel)
3. [上传代码](#3-上传代码)
4. [配置环境变量](#4-配置环境变量)
5. [部署应用](#5-部署应用)
6. [配置域名和 SSL](#6-配置域名和-ssl)
7. [应用管理](#7-应用管理)
8. [常见问题](#8-常见问题)

---

## 1. 环境准备

### 1.1 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 硬盘 | 40GB | 100GB+ SSD |
| 系统 | CentOS 7+ / Ubuntu 18+ / Debian 10+ | Ubuntu 20.04+ |

### 1.2 端口要求

确保以下端口可访问：

| 端口 | 用途 |
|------|------|
| 80 | HTTP |
| 443 | HTTPS |
| 3001 | 后端 API（可选，建议仅内网） |
| 8888 | 1Panel 面板 |

---

## 2. 安装 1Panel

### 2.1 安装命令

```bash
# CentOS/RHEL
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sh quick_start.sh

# Ubuntu/Debian
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sudo bash quick_start.sh
```

### 2.2 安装过程

安装脚本会自动：
1. 安装 Docker 和 Docker Compose
2. 下载并安装 1Panel
3. 设置开机自启动

安装完成后会显示：
```
1Panel 面板信息：
面板地址: http://你的IP:8888/xxxxxxx
用户名: xxxxxxx
密码: xxxxxxx
```

**请务必记录这些信息！**

### 2.3 登录面板

1. 浏览器访问面板地址
2. 输入用户名和密码
3. 首次登录建议修改默认端口和安全入口

---

## 3. 上传代码

### 3.1 创建项目目录

1Panel 默认应用目录为 `/opt/1panel/apps`，建议在此目录创建项目：

```bash
# SSH 登录服务器
ssh root@你的服务器IP

# 创建项目目录
mkdir -p /opt/1panel/apps/renyang-system
cd /opt/1panel/apps/renyang-system
```

### 3.2 上传代码

**方式一：Git 克隆（推荐）**

```bash
cd /opt/1panel/apps
git clone https://github.com/iGewen/renyang-system.git renyang-system
```

**方式二：1Panel 文件管理**

1. 1Panel -> 主机 -> 文件
2. 进入 `/opt/1panel/apps/renyang-system`
3. 点击 **上传**，上传项目压缩包
4. 右键解压

**方式三：SCP 上传**

```bash
# 本地执行
scp -r ./renyang-system root@你的服务器IP:/opt/1panel/apps/
```

---

## 4. 配置环境变量

### 4.1 创建配置文件

```bash
cd /opt/1panel/apps/renyang-system

# 复制示例配置
cp .env.docker .env
```

### 4.2 编辑配置

使用 1Panel 文件管理器或命令行：

```bash
nano .env
```

**必须修改的配置项：**

```ini
# ==================== 域名配置 ====================
DOMAIN=your-domain.com
EMAIL=your-email@example.com

# ==================== 数据库配置 ====================
MYSQL_ROOT_PASSWORD=YourStrongPassword123!
REDIS_PASSWORD=YourRedisPassword456!

# ==================== 安全配置 ====================
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
ADMIN_DEFAULT_PASSWORD=Admin@123456
```

### 4.3 安全密钥生成

```bash
# JWT 密钥
openssl rand -base64 32

# 数据库密码
openssl rand -base64 16
```

---

## 5. 部署应用

### 5.1 方式一：使用 1Panel 编排功能

1. 1Panel -> 容器 -> 编排
2. 点击 **创建编排**
3. 配置如下：

| 配置项 | 值 |
|--------|-----|
| 名称 | `renyang-system` |
| 工作目录 | `/opt/1panel/apps/renyang-system` |
| 编排文件 | 选择 `docker-compose.https.yml` |

4. 点击 **确认** 创建
5. 点击 **启动** 运行

### 5.2 方式二：命令行启动

```bash
cd /opt/1panel/apps/renyang-system

# HTTP 版本（测试用）
docker compose up -d

# HTTPS 版本（生产环境）
docker compose -f docker-compose.https.yml up -d
```

### 5.3 查看运行状态

**1Panel 界面：**

1. 容器 -> 容器列表
2. 查看所有 `renyang-*` 开头的容器

**命令行：**

```bash
# 查看容器状态
docker ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 6. 配置域名和 SSL

### 6.1 配置域名解析

在域名服务商处添加 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|----------|----------|--------|
| A | @ | 你的服务器IP |
| A | www | 你的服务器IP |

### 6.2 使用 1Panel 配置网站

1. 1Panel -> 网站 -> 网站
2. 点击 **创建网站**
3. 选择 **反向代理**

| 配置项 | 值 |
|--------|-----|
| 域名 | `your-domain.com` |
| 代理地址 | `http://127.0.0.1:80` |

> 注意：如果 Docker 直接映射 80 端口，可能需要修改为其他端口，如 `http://127.0.0.1:8080`

### 6.3 配置 SSL 证书

**方式一：自动申请（推荐）**

Docker Compose HTTPS 版本已集成 Certbot：

```bash
# 确保 .env 中配置正确
DOMAIN=your-domain.com
EMAIL=your-email@example.com

# 启动后会自动申请证书
docker compose -f docker-compose.https.yml up -d

# 查看证书申请日志
docker logs certbot
```

**方式二：1Panel 申请**

1. 网站 -> 点击域名 -> HTTPS
2. 点击 **申请证书**
3. 选择 Let's Encrypt
4. 输入邮箱，点击申请

### 6.4 强制 HTTPS

如果使用 1Panel Nginx：

1. 网站 -> 点击域名 -> HTTPS
2. 开启 **强制 HTTPS**

---

## 7. 应用管理

### 7.1 容器管理

**1Panel 界面操作：**

- **启动/停止/重启**：容器列表 -> 操作按钮
- **查看日志**：点击容器 -> 日志
- **进入终端**：点击容器 -> 终端
- **资源监控**：容器列表可看到 CPU/内存使用

### 7.2 数据库管理

**访问 MySQL：**

1. 1Panel -> 容器 -> 容器列表
2. 找到 `renyang-mysql`
3. 点击 **终端** 进入
4. 执行 MySQL 命令：
   ```bash
   mysql -u root -p
   # 输入 MYSQL_ROOT_PASSWORD
   ```

**使用 1Panel 数据库管理：**

1. 数据库 -> MySQL
2. 点击 **添加 MySQL 服务器**
3. 配置连接信息：

| 配置项 | 值 |
|--------|-----|
| 名称 | `renyang-mysql` |
| 地址 | `容器IP或127.0.0.1` |
| 端口 | `3306` |
| 用户名 | `root` |
| 密码 | `.env 中的 MYSQL_ROOT_PASSWORD` |

### 7.3 备份与恢复

**手动备份：**

```bash
# 备份 MySQL
docker exec renyang-mysql mysqldump -u root -p'YourPassword' cloud_ranch > /opt/backup/mysql_$(date +%Y%m%d).sql

# 备份上传文件
tar -czf /opt/backup/uploads_$(date +%Y%m%d).tar.gz /opt/1panel/apps/renyang-system/backend/uploads
```

**定时备份：**

1. 1Panel -> 计划任务
2. 创建 Shell 脚本任务
3. 设置执行时间（如每天凌晨 3 点）

### 7.4 监控告警

1. 1Panel -> 监控
2. 开启 **告警通知**
3. 配置通知方式（邮件、钉钉、微信）
4. 设置告警规则：
   - CPU 使用率 > 80%
   - 内存使用率 > 85%
   - 磁盘使用率 > 90%

---

## 8. 更新应用

### 8.1 标准更新流程

```bash
cd /opt/1panel/apps/renyang-system

# 1. 备份数据
docker exec renyang-mysql mysqldump -u root -p'YourPassword' cloud_ranch > /opt/backup/pre_update.sql

# 2. 拉取最新代码
git pull origin dev

# 3. 重新构建
docker compose down
docker compose build --no-cache
docker compose -f docker-compose.https.yml up -d

# 4. 检查状态
docker compose ps
docker compose logs -f
```

### 8.2 1Panel 界面更新

1. 容器 -> 编排 -> 选择 `renyang-system`
2. 点击 **重新部署**
3. 等待容器重启完成

---

## 9. 常见问题

### Q1: 容器启动失败

**排查步骤：**

```bash
# 查看容器日志
docker compose logs backend
docker compose logs frontend

# 检查配置文件
cat .env

# 检查端口占用
netstat -tlnp | grep -E '80|443|3001|3306|6379'
```

### Q2: 域名无法访问

**排查步骤：**

1. 检查域名解析：
   ```bash
   ping your-domain.com
   ```

2. 检查防火墙：
   ```bash
   # 查看防火墙状态
   ufw status
   
   # 放行端口
   ufw allow 80
   ufw allow 443
   ```

3. 检查容器状态：
   ```bash
   docker ps | grep renyang
   ```

### Q3: SSL 证书申请失败

**可能原因：**

1. 域名未正确解析到服务器
2. 80 端口不可访问
3. 申请频率限制（每周 5 次）

**解决方案：**

```bash
# 测试 80 端口
curl -I http://your-domain.com

# 查看 Certbot 日志
docker logs certbot

# 手动续期
docker exec certbot certbot renew
```

### Q4: 数据库连接失败

```bash
# 检查 MySQL 容器
docker ps | grep mysql
docker logs renyang-mysql

# 测试连接
docker exec -it renyang-mysql mysql -u root -p

# 检查网络
docker network ls
docker network inspect renyang-system_default
```

### Q5: 内存不足

```bash
# 查看内存使用
free -h

# 查看 Docker 资源使用
docker stats

# 添加 Swap（如果内存小于 4GB）
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Q6: 后端 API 无法访问

1. 检查后端容器状态：
   ```bash
   docker ps | grep backend
   docker logs renyang-backend
   ```

2. 测试健康检查：
   ```bash
   curl http://localhost:3001/health
   ```

3. 检查 JWT 配置：
   ```bash
   # 确保 .env 中有 JWT_SECRET
   grep JWT_SECRET .env
   ```

---

## 10. 安全加固

### 10.1 修改默认端口

```bash
# 修改 1Panel 端口
# 1Panel -> 设置 -> 安全 -> 面板端口

# 修改 SSH 端口
# 1Panel -> 主机 -> SSH -> 端口设置
```

### 10.2 配置防火墙

1. 1Panel -> 主机 -> 防火墙
2. 只开放必要端口：
   - 80 (HTTP)
   - 443 (HTTPS)
   - 8888 (1Panel，可限制 IP)
   - 22 (SSH，建议修改默认端口)

### 10.3 定期更新

```bash
# 更新系统
apt update && apt upgrade -y

# 更新 Docker 镜像
docker compose pull
docker compose up -d
```

---

## 11. 性能优化

### 11.1 开启 HTTP/2

1Panel 网站 HTTPS 设置中已默认开启。

### 11.2 配置缓存

Nginx 配置（在 1Panel 网站设置中添加）：

```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# API 不缓存
location /api {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 11.3 数据库优化

```bash
# 进入 MySQL 容器
docker exec -it renyang-mysql mysql -u root -p

# 查看状态
SHOW STATUS LIKE 'Threads%';
SHOW VARIABLES LIKE 'max_connections';

# 优化表
OPTIMIZE TABLE users, orders, livestocks;
```

---

## 联系支持

如有问题，请提交 GitHub Issue：https://github.com/iGewen/renyang-system/issues
