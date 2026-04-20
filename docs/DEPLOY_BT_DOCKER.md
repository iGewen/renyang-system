# 宝塔面板 Docker 部署教程

本文档详细介绍如何使用宝塔面板 + Docker 部署云端牧场系统。

---

## 目录

- [1. 环境准备](#1-环境准备)
- [2. 安装 Docker](#2-安装-docker)
- [3. 上传代码](#3-上传代码)
- [4. 配置环境变量](#4-配置环境变量)
- [5. 启动服务](#5-启动服务)
- [6. 使用宝塔管理数据库](#6-使用宝塔管理数据库)
- [7. 配置网站（可选）](#7-配置网站可选)
- [8. 常见问题](#8-常见问题)

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
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh

# Ubuntu/Deepin 安装命令
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
```

安装完成后，记录面板登录地址、用户名和密码。

---

## 2. 安装 Docker

### 方式一：宝塔应用商店（推荐）

1. 登录宝塔面板
2. 点击左侧菜单 **Docker**
3. 点击 **安装**
4. 等待安装完成

### 方式二：命令行安装

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

# 启动服务
systemctl start docker && systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

---

## 3. 上传代码

### 3.1 创建目录

```bash
mkdir -p /www/wwwroot/renyang-system
cd /www/wwwroot/renyang-system
```

### 3.2 上传方式

**Git 克隆（推荐）：**
```bash
cd /www/wwwroot
git clone https://github.com/iGewen/renyang-system.git renyang-system
```

**宝塔文件管理：**
1. 宝塔面板 → 文件 → 进入 `/www/wwwroot/renyang-system`
2. 上传项目压缩包 → 右键解压

---

## 4. 配置环境变量

### 4.1 创建配置文件

```bash
cd /www/wwwroot/renyang-system
cp .env.docker .env
```

### 4.2 编辑配置

```bash
nano .env
```

**必须修改以下配置：**

```ini
# ==================== 域名配置 ====================
DOMAIN=your-domain.com          # 你的域名
EMAIL=your-email@example.com    # 证书提醒邮箱

# ==================== 数据库配置 ====================
MYSQL_ROOT_PASSWORD=YourStrongPassword123!    # MySQL 密码（务必修改）
REDIS_PASSWORD=YourRedisPassword456!          # Redis 密码（务必修改）

# ==================== 安全配置 ====================
JWT_SECRET=your-super-secret-key-at-least-32-chars  # JWT 密钥（务必修改）
ADMIN_DEFAULT_PASSWORD=Admin@123456                  # 管理员初始密码
```

**生成安全密钥：**
```bash
# 生成 32 位随机密钥
openssl rand -base64 32
```

---

## 5. 启动服务

### 5.1 启动 Docker 容器

```bash
cd /www/wwwroot/renyang-system

# 方式一：HTTP 部署（测试用，自动申请 SSL）
docker compose -f docker-compose.https.yml up -d

# 方式二：HTTP 部署（配合宝塔 Nginx 使用）
docker compose up -d
```

### 5.2 查看状态

```bash
# 查看运行容器
docker ps

# 查看日志
docker compose logs -f
```

### 5.3 验证服务

| 服务 | 访问地址 | 说明 |
|------|----------|------|
| 前端 | `http://你的IP` | 网站首页 |
| 后端 | `http://你的IP:3001/health` | 健康检查 |

---

## 6. 使用宝塔管理数据库

### 6.1 暴露数据库端口

**修改 `docker-compose.yml`，添加端口映射：**

```yaml
services:
  # ... 其他服务 ...

  mysql:
    image: mysql:8.0
    # ... 其他配置 ...
    ports:
      - "127.0.0.1:3306:3306"    # 添加这行，只允许本地访问
    # ... 其他配置 ...

  redis:
    image: redis:7-alpine
    # ... 其他配置 ...
    ports:
      - "127.0.0.1:6379:6379"    # 添加这行，只允许本地访问
    # ... 其他配置 ...
```

> ⚠️ 使用 `127.0.0.1` 绑定只允许本地访问，更安全！

**重启容器使配置生效：**
```bash
docker compose down
docker compose up -d
```

### 6.2 宝塔连接 MySQL

**步骤：**

1. 宝塔面板 → **数据库** → **添加数据库服务器**

2. 填写连接信息：

   | 配置项 | 值 |
   |--------|-----|
   | 服务器名称 | `renyang-mysql` |
   | 服务器地址 | `127.0.0.1` |
   | 端口 | `3306` |
   | 用户名 | `root` |
   | 密码 | `.env` 文件中的 `MYSQL_ROOT_PASSWORD` |

3. 点击 **提交**

4. 连接成功后，可以：
   - 查看所有数据库
   - 执行 SQL 语句
   - 导入/导出数据
   - 修改表结构

**管理项目数据库：**

连接成功后，找到 `cloud_ranch` 数据库，这就是项目的业务数据库。

### 6.3 宝塔连接 Redis

**安装 Redis 管理器：**

1. 宝塔面板 → **软件商店**
2. 搜索 **Redis** → 点击 **安装**
3. 安装完成后 → 点击 **设置**

**配置连接 Docker Redis：**

由于宝塔内置 Redis 管理器主要用于管理本地 Redis，连接 Docker Redis 有两种方式：

**方式一：使用命令行工具**

```bash
# 进入 Redis 容器
docker exec -it renyang-redis redis-cli

# 认证（使用 .env 中的 REDIS_PASSWORD）
AUTH YourRedisPassword456

# 测试命令
PING
KEYS *
```

**方式二：安装 Redis 可视化工具**

推荐使用 **Another Redis Desktop Manager**（免费）：
- 下载地址：https://github.com/qishibo/AnotherRedisDesktopManager/releases
- 连接地址：`127.0.0.1:6379`
- 密码：`.env` 中的 `REDIS_PASSWORD`

### 6.4 数据库备份

**手动备份：**

```bash
# 备份 MySQL
docker exec renyang-mysql mysqldump -u root -p'YourPassword' cloud_ranch > /www/backup/mysql_$(date +%Y%m%d).sql

# 备份 Redis（如果需要）
docker exec renyang-redis redis-cli -a 'YourPassword' BGSAVE
docker cp renyang-redis:/data/dump.rdb /www/backup/redis_$(date +%Y%m%d).rdb
```

**定时备份（宝塔计划任务）：**

1. 宝塔面板 → **计划任务**
2. 添加任务：

   | 配置项 | 值 |
   |--------|-----|
   | 任务类型 | Shell 脚本 |
   | 任务名称 | MySQL 备份 |
   | 执行周期 | 每天 03:00 |
   | 脚本内容 | 见下方 |

```bash
#!/bin/bash
BACKUP_DIR="/www/backup"
MYSQL_PASS="YourPassword"  # 替换为实际密码
DATE=$(date +%Y%m%d)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec renyang-mysql mysqldump -u root -p"$MYSQL_PASS" cloud_ranch > $BACKUP_DIR/mysql_$DATE.sql

# 删除 7 天前的备份
find $BACKUP_DIR -name "mysql_*.sql" -mtime +7 -delete

echo "备份完成: mysql_$DATE.sql"
```

---

## 7. 配置网站（可选）

> 💡 如果使用 `docker-compose.https.yml` 启动，Docker 已经处理了 HTTPS，**跳过此章节**。

### 7.1 两种部署方式对比

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| 纯 Docker | 使用 `docker-compose.https.yml` | 简单、一体化部署 |
| Docker + 宝塔 Nginx | 使用 `docker-compose.yml` + 宝塔反向代理 | 需要宝塔管理网站 |

### 7.2 Docker + 宝塔 Nginx 配置

**第一步：修改 Docker 端口**

编辑 `docker-compose.yml`，避免端口冲突：

```yaml
services:
  frontend:
    # ... 其他配置 ...
    ports:
      - "8080:80"    # 改用 8080 端口
```

**第二步：重启 Docker**

```bash
docker compose down
docker compose up -d
```

**第三步：宝塔添加网站**

1. 宝塔面板 → **网站** → **添加站点**

   | 配置项 | 值 |
   |--------|-----|
   | 域名 | `your-domain.com` |
   | 根目录 | `/www/wwwroot/renyang-system` |
   | PHP 版本 | 纯静态 |
   | 数据库 | 不创建 |

2. 点击 **提交**

**第四步：配置反向代理**

1. 网站 → 点击域名 → **设置**
2. 左侧菜单 → **反向代理** → **添加反向代理**

   | 配置项 | 值 |
   |--------|-----|
   | 代理名称 | `renyang-frontend` |
   | 目标 URL | `http://127.0.0.1:8080` |
   | 发送域名 | `$host` |

3. 点击 **提交**

**第五步：申请 SSL 证书**

1. 网站 → 点击域名 → **设置**
2. 左侧菜单 → **SSL** → **Let's Encrypt**
3. 勾选域名 → 输入邮箱 → **申请**
4. 申请成功后，开启 **强制 HTTPS**

---

## 8. 常见问题

### Q1: 端口冲突怎么办？

**问题：** 启动 Docker 时提示端口被占用

**解决：**
```bash
# 查看端口占用
netstat -tlnp | grep :80

# 停止占用服务
systemctl stop nginx    # 停止宝塔 Nginx

# 或修改 Docker 端口
# 编辑 docker-compose.yml，改用其他端口
```

### Q2: 宝塔连接 MySQL 失败？

**检查步骤：**

1. 确认端口已映射：
   ```bash
   docker ps | grep mysql
   # 查看 PORTS 列是否有 0.0.0.0:3306->3306/tcp
   ```

2. 确认密码正确：
   ```bash
   # 查看环境变量
   cat .env | grep MYSQL_ROOT_PASSWORD
   ```

3. 测试连接：
   ```bash
   docker exec -it renyang-mysql mysql -u root -p
   ```

### Q3: 容器无法启动？

**查看日志：**
```bash
# 查看所有日志
docker compose logs

# 查看特定服务
docker compose logs backend
docker compose logs mysql
```

**常见原因：**
- `.env` 文件未配置
- 端口被占用
- 内存不足

### Q4: 如何更新系统？

```bash
cd /www/wwwroot/renyang-system

# 备份数据库
docker exec renyang-mysql mysqldump -u root -p'密码' cloud_ranch > backup.sql

# 拉取代码
git pull origin dev

# 重新部署
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Q5: 如何重置管理员密码？

```bash
# 进入后端容器
docker exec -it renyang-backend bash

# 或直接连接数据库修改
docker exec -it renyang-mysql mysql -u root -p

# 执行 SQL
USE cloud_ranch;
-- 需要生成新的 bcrypt 哈希值
UPDATE admin SET password = '新的bcrypt哈希' WHERE username = 'admin';
```

---

## 9. 快速命令参考

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 查看容器状态
docker ps

# 进入 MySQL
docker exec -it renyang-mysql mysql -u root -p

# 进入 Redis
docker exec -it renyang-redis redis-cli -a '密码'

# 重启单个服务
docker compose restart backend

# 查看资源占用
docker stats
```

---

## 联系支持

如有问题，请提交 GitHub Issue：https://github.com/iGewen/renyang-system/issues
