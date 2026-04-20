# 宝塔面板 Docker 部署教程

本文档详细介绍如何使用宝塔面板 + Docker 部署云端牧场系统。

## 目录

1. [环境准备](#1-环境准备)
2. [安装 Docker](#2-安装-docker)
3. [上传代码](#3-上传代码)
4. [配置环境变量](#4-配置环境变量)
5. [启动服务](#5-启动服务)
6. [配置网站](#6-配置网站)
7. [配置 SSL 证书](#7-配置-ssl-证书)
8. [常见问题](#8-常见问题)

---

## 1. 环境准备

### 1.1 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 硬盘 | 40GB | 100GB+ SSD |
| 系统 | CentOS 7+ / Ubuntu 18+ | Ubuntu 20.04+ |

### 1.2 安装宝塔面板

```bash
# CentOS 安装命令
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh ed8484bec

# Ubuntu/Deepin 安装命令
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
```

安装完成后，记录面板登录地址、用户名和密码。

### 1.3 登录宝塔面板

1. 浏览器访问面板地址（如 `http://你的IP:8888`）
2. 输入用户名和密码登录
3. 首次登录会推荐安装套件，选择 **LNMP** 或 **LAMP**（可选，因为我们将使用 Docker）

---

## 2. 安装 Docker

### 2.1 通过宝塔应用商店安装

1. 登录宝塔面板
2. 点击左侧菜单 **Docker**
3. 点击 **安装** 按钮
4. 等待安装完成（约 3-5 分钟）

### 2.2 命令行安装（备用）

如果宝塔应用商店没有 Docker，可以通过命令行安装：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

# 启动 Docker 服务
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

## 3. 上传代码

### 3.1 创建项目目录

```bash
# SSH 登录服务器
ssh root@你的服务器IP

# 创建项目目录
mkdir -p /www/wwwroot/renyang-system
cd /www/wwwroot/renyang-system
```

### 3.2 上传代码文件

**方式一：Git 克隆（推荐）**

```bash
cd /www/wwwroot
git clone https://github.com/iGewen/renyang-system.git renyang-system
cd renyang-system
```

**方式二：宝塔文件管理上传**

1. 宝塔面板 -> 文件
2. 进入 `/www/wwwroot/renyang-system`
3. 点击 **上传**，上传项目压缩包
4. 右键解压

### 3.3 设置目录权限

```bash
# 设置目录所有者
chown -R www:www /www/wwwroot/renyang-system

# 设置权限
chmod -R 755 /www/wwwroot/renyang-system
```

---

## 4. 配置环境变量

### 4.1 创建环境配置文件

```bash
cd /www/wwwroot/renyang-system

# 复制示例配置
cp .env.docker .env
```

### 4.2 编辑配置文件

使用宝塔文件管理器或命令行编辑 `.env` 文件：

```bash
nano .env
```

**必须修改的配置项：**

```ini
# ==================== 域名配置 ====================
# 你的网站域名（不含 http://）
DOMAIN=your-domain.com

# Let's Encrypt 邮箱（用于证书到期提醒）
EMAIL=your-email@example.com

# ==================== 数据库配置 ====================
# MySQL root 密码（务必修改为强密码！）
MYSQL_ROOT_PASSWORD=YourStrongPassword123!

# Redis 密码（务必修改！）
REDIS_PASSWORD=YourRedisPassword456!

# ==================== 安全配置 ====================
# JWT 密钥（务必修改为32位以上的随机字符串！）
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# 管理员默认密码（首次启动生效，登录后强制修改）
ADMIN_DEFAULT_PASSWORD=Admin@123456
```

### 4.3 生成安全的密钥

```bash
# 生成 JWT 密钥（32位随机字符串）
openssl rand -base64 32

# 生成 MySQL 密码
openssl rand -base64 16
```

---

## 5. 启动服务

### 5.1 启动 Docker 容器

```bash
cd /www/wwwroot/renyang-system

# 启动所有服务（HTTP 版本，用于测试）
docker compose up -d

# 或启动 HTTPS 版本（生产环境推荐）
docker compose -f docker-compose.https.yml up -d
```

### 5.2 查看服务状态

```bash
# 查看运行中的容器
docker ps

# 查看日志
docker compose logs -f
```

### 5.3 验证服务

| 服务 | 默认端口 | 验证方式 |
|------|----------|----------|
| 前端 | 80/443 | 浏览器访问 `http://你的域名` |
| 后端 | 3001 | 浏览器访问 `http://你的域名:3001/health` |
| MySQL | 3306 | 仅容器内部访问 |
| Redis | 6379 | 仅容器内部访问 |

---

## 6. 配置网站

### 6.1 宝塔面板添加网站

1. 宝塔面板 -> 网站 -> 添加站点
2. 配置如下：

| 配置项 | 值 |
|--------|-----|
| 域名 | `your-domain.com` |
| 根目录 | `/www/wwwroot/renyang-system` |
| PHP版本 | 纯静态（使用 Docker） |
| 数据库 | 不创建（使用 Docker MySQL） |

### 6.2 配置 Nginx 反向代理（可选）

如果需要通过宝塔管理 Nginx：

1. 网站 -> 点击域名 -> 设置
2. 反向代理 -> 添加反向代理

**前端代理配置：**

| 配置项 | 值 |
|--------|-----|
| 代理名称 | `renyang-frontend` |
| 目标URL | `http://127.0.0.1:80` |
| 发送域名 | `$host` |

> 注意：如果 Docker 已经占用 80 端口，需要修改 Docker 映射端口或停止 Docker 的端口映射，改用宝塔 Nginx。

### 6.3 推荐的端口分配方案

修改 `docker-compose.yml` 或 `docker-compose.https.yml`：

```yaml
services:
  frontend:
    ports:
      - "8080:80"   # 前端改用 8080 端口
```

然后宝塔 Nginx 反向代理到 `http://127.0.0.1:8080`

---

## 7. 配置 SSL 证书

### 7.1 使用 Let's Encrypt 自动申请（推荐）

Docker Compose HTTPS 版本已集成 Certbot，会自动申请和续期：

```bash
# 确保 .env 中配置了域名和邮箱
DOMAIN=your-domain.com
EMAIL=your-email@example.com

# 启动 HTTPS 版本
docker compose -f docker-compose.https.yml up -d
```

证书会自动申请并配置，保存在 `certbot/conf/` 目录。

### 7.2 使用宝塔面板申请证书

1. 网站 -> 点击域名 -> SSL
2. Let's Encrypt -> 申请证书
3. 输入邮箱，点击申请

### 7.3 使用自有证书

1. 网站 -> 点击域名 -> SSL
2. 其他证书 -> 粘贴证书内容
3. 保存并启用

---

## 8. 宝塔面板管理

### 8.1 Docker 管理界面

宝塔面板 -> Docker：

- **容器管理**：启动、停止、重启容器
- **镜像管理**：查看、删除镜像
- **日志查看**：实时查看容器日志
- **资源监控**：CPU、内存使用情况

### 8.2 定时任务（备份）

宝塔面板 -> 计划任务：

**数据库备份：**

```bash
# 每天凌晨 3 点备份 MySQL
0 3 * * * docker exec renyang-mysql mysqldump -u root -p'YourPassword' cloud_ranch > /www/backup/mysql_$(date +\%Y\%m\%d).sql
```

**上传目录备份：**

```bash
# 每天凌晨 4 点备份上传文件
0 4 * * * tar -czf /www/backup/uploads_$(date +\%Y\%m\%d).tar.gz /www/wwwroot/renyang-system/backend/uploads
```

### 8.3 监控告警

宝塔面板 -> 监控：

- 开启 CPU、内存、磁盘告警
- 设置告警阈值（如 CPU > 80%）
- 配置告警通知方式（微信、邮件）

---

## 9. 常见问题

### Q1: 端口被占用

**问题：** 启动 Docker 时提示端口被占用

**解决：**
```bash
# 查看端口占用
netstat -tlnp | grep :80

# 停止占用端口的服务
systemctl stop nginx  # 如果宝塔 Nginx 占用 80 端口

# 或修改 Docker 映射端口
# 编辑 docker-compose.yml，将 "80:80" 改为 "8080:80"
```

### Q2: 容器无法启动

**问题：** Docker 容器启动失败

**解决：**
```bash
# 查看容器日志
docker compose logs backend
docker compose logs frontend

# 常见原因：
# 1. .env 文件未正确配置
# 2. 目录权限不足：chmod -R 755 /www/wwwroot/renyang-system
# 3. 内存不足：free -h 查看内存
```

### Q3: 数据库连接失败

**问题：** 后端无法连接 MySQL

**解决：**
```bash
# 检查 MySQL 容器状态
docker ps | grep mysql

# 检查 MySQL 日志
docker logs renyang-mysql

# 进入 MySQL 容器测试连接
docker exec -it renyang-mysql mysql -u root -p
```

### Q4: SSL 证书申请失败

**问题：** Let's Encrypt 证书申请失败

**解决：**
1. 确保域名已正确解析到服务器 IP
2. 确保 80 和 443 端口可从外网访问
3. 检查防火墙设置：
   ```bash
   # 宝塔防火墙放行端口
   firewall-cmd --permanent --add-port=80/tcp
   firewall-cmd --permanent --add-port=443/tcp
   firewall-cmd --reload
   ```

### Q5: 如何更新系统

```bash
cd /www/wwwroot/renyang-system

# 拉取最新代码
git pull origin dev

# 重新构建并启动
docker compose down
docker compose build --no-cache
docker compose up -d

# 执行数据库迁移（如有）
docker exec -it renyang-backend npm run migration:run
```

### Q6: 如何重置管理员密码

```bash
# 进入后端容器
docker exec -it renyang-backend bash

# 重置密码
npm run reset-admin-password

# 或直接修改数据库
docker exec -it renyang-mysql mysql -u root -p
USE cloud_ranch;
UPDATE admin SET password = '新的bcrypt哈希值' WHERE username = 'admin';
```

---

## 10. 性能优化

### 10.1 开启 Redis 缓存

系统默认已集成 Redis，会自动缓存：
- 用户 Session
- API 响应缓存
- 微信 access_token

### 10.2 MySQL 调优

编辑 `mysql/my.cnf`（需创建）：

```ini
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
```

### 10.3 开启 Gzip 压缩

前端 Nginx 配置（已在 Docker 中预配置）：
- Gzip 压缩：已开启
- 静态资源缓存：已开启

---

## 联系支持

如有问题，请提交 GitHub Issue：https://github.com/iGewen/renyang-system/issues
