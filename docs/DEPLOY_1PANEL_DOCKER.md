# 1Panel Docker 部署教程

本文档详细介绍如何使用 1Panel 面板 + Docker 部署云端牧场系统。

---

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 安装 1Panel](#2-安装-1panel)
- [3. 配置镜像加速](#3-配置镜像加速)
- [4. 上传代码](#4-上传代码)
- [5. 配置环境变量](#5-配置环境变量)
- [6. 部署应用](#6-部署应用)
- [7. 使用 1Panel 管理数据库](#7-使用-1panel-管理数据库)
- [8. 配置域名和 SSL](#8-配置域名和-ssl)
- [9. 常见问题](#9-常见问题)

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

| 端口 | 用途 | 说明 |
|------|------|------|
| 80 | HTTP | 网站访问 |
| 443 | HTTPS | 安全访问 |
| 3001 | 后端 API | 可选 |
| 8888 | 1Panel 面板 | 管理后台 |

---

## 2. 安装 1Panel

### 2.1 一键安装

```bash
# CentOS/RHEL
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sh quick_start.sh

# Ubuntu/Debian
curl -sSL https://resource.fit2cloud.com/1panel/package/quick_start.sh -o quick_start.sh && sudo bash quick_start.sh
```

### 2.2 安装完成

安装成功后会显示：

```
==================================================================
1Panel 面板信息：
面板地址: http://你的IP:8888/xxxxxxxx
用户名: xxxxxxxx
密码: xxxxxxxx
==================================================================
```

> ⚠️ **请务必保存这些信息！**

### 2.3 登录面板

浏览器访问面板地址，输入用户名和密码登录。

---

## 3. 配置镜像加速

### 3.1 为什么需要配置？

本项目使用阿里云 ACR 镜像仓库，国内服务器拉取 Docker Hub 镜像经常超时。配置镜像加速可以解决这个问题。

### 3.2 1Panel 配置镜像加速

1. 1Panel → **容器** → **配置**
2. 找到 **镜像加速** 设置
3. 添加加速器地址（可添加多个）：

```
https://registry.cn-hangzhou.aliyuncs.com
https://mirror.ccs.tencentyun.com
```

4. 点击 **保存并重启**

### 3.3 命令行配置（备用）

```bash
# 编辑 Docker 配置
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://mirror.ccs.tencentyun.com"
  ]
}
EOF

# 重启 Docker
systemctl daemon-reload
systemctl restart docker
```

### 3.4 登录阿里云 ACR（可选）

如果需要拉取私有镜像：

```bash
# 登录阿里云容器镜像服务
docker login --username=你的阿里云账号 crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com

# 输入密码（在阿里云 ACR 控制台获取）
```

---

## 4. 上传代码

### 4.1 创建项目目录

```bash
mkdir -p /opt/renyang-system
cd /opt/renyang-system
```

### 4.2 上传方式

**方式一：Git 克隆（推荐）**

```bash
cd /opt
git clone https://github.com/iGewen/renyang-system.git renyang-system
```

**方式二：1Panel 文件管理**

1. 1Panel → **主机** → **文件**
2. 进入 `/opt/renyang-system`
3. 上传项目压缩包 → 右键解压

**方式三：SCP 上传（本地执行）**

```bash
scp -r ./renyang-system root@你的服务器IP:/opt/
```

### 4.3 设置权限

```bash
chown -R root:root /opt/renyang-system
chmod -R 755 /opt/renyang-system
```

---

## 5. 配置环境变量

### 5.1 创建配置文件

```bash
cd /opt/renyang-system
cp .env.docker .env
```

### 5.2 编辑配置

使用 1Panel 文件管理器编辑，或命令行：

```bash
nano .env
```

### 5.3 必须修改的配置

```ini
# ==================== 域名配置 ====================
DOMAIN=your-domain.com
EMAIL=your-email@example.com

# ==================== 数据库配置 ====================
# MySQL root 密码（务必修改！）
MYSQL_ROOT_PASSWORD=YourStrongPassword123!

# Redis 密码（务必修改！）
REDIS_PASSWORD=YourRedisPassword456!

# ==================== 安全配置 ====================
# JWT 密钥（至少32位随机字符串）
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# 管理员默认密码
ADMIN_DEFAULT_PASSWORD=Admin@123456
```

### 5.4 生成安全密钥

```bash
# 生成 32 位随机密钥
openssl rand -base64 32
```

---

## 6. 部署应用

### 6.1 方式一：1Panel 编排（推荐）

**步骤：**

1. 1Panel → **容器** → **编排**
2. 点击 **创建编排**
3. 配置如下：

   | 配置项 | 值 |
   |--------|-----|
   | 名称 | `cloud-ranch` |
   | 工作目录 | `/opt/renyang-system` |
   | 编排文件 | 选择 `docker-compose.yml` 或 `docker-compose.https.yml` |

4. 点击 **确认**

**启动服务：**

- 在编排列表中找到 `cloud-ranch`
- 点击 **启动** 按钮
- 等待所有容器启动完成

### 6.2 方式二：命令行启动

```bash
cd /opt/renyang-system

# HTTP 模式（测试/开发）
docker compose up -d

# HTTPS 模式（生产环境，自动申请 SSL）
docker compose -f docker-compose.https.yml up -d
```

### 6.3 查看运行状态

**1Panel 界面：**

1. 容器 → 容器列表
2. 查看所有 `cloud-ranch-*` 容器
3. 点击容器名称可查看详情、日志、终端

**命令行：**

```bash
# 查看容器状态
docker ps

# 查看所有日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 6.4 验证部署

| 服务 | 验证地址 | 预期结果 |
|------|----------|----------|
| 前端 | `http://你的IP` | 显示网站首页 |
| 后端 | `http://你的IP:3001/health` | 返回 `{"status":"ok"}` |
| 后端 API | `http://你的IP:3001/api/docs` | 显示 Swagger 文档 |

---

## 7. 使用 1Panel 管理数据库

### 7.1 查看数据库端口

项目 `docker-compose.yml` 已配置数据库端口映射：

```yaml
# MySQL 端口映射（仅本地访问）
ports:
  - "127.0.0.1:3306:3306"

# Redis 端口映射（仅本地访问）
ports:
  - "127.0.0.1:6379:6379"
```

### 7.2 连接 MySQL

**步骤：**

1. 1Panel → **数据库** → **MySQL**
2. 点击 **添加 MySQL 服务器**

3. 填写连接信息：

   | 配置项 | 值 |
   |--------|-----|
   | 名称 | `cloud-ranch-mysql` |
   | 地址 | `127.0.0.1` |
   | 端口 | `3306` |
   | 用户名 | `root` |
   | 密码 | `.env` 中的 `MYSQL_ROOT_PASSWORD` |

4. 点击 **测试连接** → 确认成功 → **确认添加**

**管理数据库：**

- 点击数据库名称 `cloud_ranch`
- 可以执行 SQL、导入导出、查看表结构

### 7.3 连接 Redis

1Panel 内置 Redis 管理功能：

1. 1Panel → **主机** → **终端**
2. 执行命令连接 Redis：

```bash
# 进入 Redis 容器
docker exec -it cloud-ranch-redis redis-cli

# 认证（使用 .env 中的 REDIS_PASSWORD）
AUTH YourRedisPassword456

# 测试
PING
# 返回 PONG

# 查看所有键
KEYS *
```

**或使用 Redis 可视化工具：**

推荐 **Another Redis Desktop Manager**（免费）：
- 下载：https://github.com/qishibo/AnotherRedisDesktopManager
- 连接地址：`127.0.0.1`
- 端口：`6379`
- 密码：`.env` 中的 `REDIS_PASSWORD`

### 7.4 数据库备份

**1Panel 定时任务：**

1. 1Panel → **计划任务**
2. 点击 **创建计划任务**

3. 配置：

   | 配置项 | 值 |
   |--------|-----|
   | 任务类型 | Shell 脚本 |
   | 任务名称 | MySQL 自动备份 |
   | 执行周期 | 每天 03:00 |
   | 脚本内容 | 见下方 |

```bash
#!/bin/bash
# 自动备份脚本

BACKUP_DIR="/opt/backup"
MYSQL_PASS="YourPassword"  # 替换为你的密码
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec cloud-ranch-mysql mysqldump -u root -p"$MYSQL_PASS" cloud_ranch > "$BACKUP_DIR/mysql_$DATE.sql"

# 压缩备份
gzip "$BACKUP_DIR/mysql_$DATE.sql"

# 删除 7 天前的备份
find $BACKUP_DIR -name "mysql_*.sql.gz" -mtime +7 -delete

echo "备份完成: mysql_$DATE.sql.gz"
```

---

## 8. 配置域名和 SSL

### 8.1 配置域名解析

在域名服务商添加 A 记录：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | @ | 你的服务器 IP |
| A | www | 你的服务器 IP |

### 8.2 使用 Docker HTTPS 模式（推荐）

如果使用 `docker-compose.https.yml`，SSL 证书会自动申请：

```bash
# 确保 .env 配置正确
DOMAIN=your-domain.com
EMAIL=your-email@example.com

# 启动服务
docker compose -f docker-compose.https.yml up -d
```

证书自动申请后保存在 `certbot/conf/` 目录，到期自动续期。

### 8.3 使用 1Panel 申请证书

如果使用 HTTP 模式 + 1Panel：

1. 1Panel → **网站** → **创建网站**
2. 选择 **反向代理**
3. 配置：

   | 配置项 | 值 |
   |--------|-----|
   | 域名 | `your-domain.com` |
   | 代理地址 | `http://127.0.0.1:80` |

4. 创建后 → 点击域名 → **HTTPS**
5. 点击 **申请证书** → Let's Encrypt
6. 输入邮箱 → **申请**

---

## 9. 应用管理

### 9.1 容器管理

**在 1Panel 界面可执行：**

| 操作 | 说明 |
|------|------|
| 启动/停止/重启 | 容器列表 → 操作按钮 |
| 查看日志 | 点击容器 → 日志标签 |
| 进入终端 | 点击容器 → 终端标签 |
| 资源监控 | 容器列表显示 CPU/内存 |

### 9.2 更新应用

```bash
cd /opt/renyang-system

# 备份数据库
docker exec cloud-ranch-mysql mysqldump -u root -p'密码' cloud_ranch > backup.sql

# 拉取最新代码
git pull origin dev

# 重新部署
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 9.3 查看资源使用

1Panel → **监控**：

- CPU 使用率
- 内存使用率
- 磁盘使用率
- 网络流量

---

## 10. 常见问题

### Q1: 镜像拉取超时？

**原因：** Docker Hub 国内访问不稳定

**解决：**
```bash
# 配置镜像加速（见第 3 章）
# 或使用项目已配置的阿里云 ACR 镜像
```

### Q2: 容器启动失败？

**排查步骤：**

```bash
# 查看容器日志
docker compose logs

# 查看特定服务
docker compose logs backend
docker compose logs mysql

# 检查配置文件
cat .env

# 检查端口占用
netstat -tlnp | grep -E '80|443|3001|3306|6379'
```

### Q3: 数据库连接失败？

**检查：**

1. 确认容器运行：`docker ps | grep mysql`
2. 确认密码正确：`cat .env | grep MYSQL_ROOT_PASSWORD`
3. 测试连接：
   ```bash
   docker exec -it cloud-ranch-mysql mysql -u root -p
   ```

### Q4: 域名无法访问？

**检查：**

1. 域名解析：`ping your-domain.com`
2. 防火墙：
   ```bash
   ufw allow 80
   ufw allow 443
   ```
3. 容器状态：`docker ps`

### Q5: SSL 证书申请失败？

**原因：**
- 域名未解析到服务器
- 80 端口不可访问
- 申请频率限制（每周 5 次）

**解决：**
```bash
# 测试 80 端口
curl -I http://your-domain.com

# 查看证书日志
docker logs certbot
```

---

## 11. 快速命令参考

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f

# 查看容器状态
docker ps

# 进入 MySQL
docker exec -it cloud-ranch-mysql mysql -u root -p

# 进入 Redis
docker exec -it cloud-ranch-redis redis-cli -a '密码'

# 查看资源使用
docker stats

# 清理无用镜像
docker image prune -f
```

---

## 联系支持

如有问题，请提交 GitHub Issue：https://github.com/iGewen/renyang-system/issues
