# Docker 部署教程 - 使用阿里云ACR镜像仓库

本文档介绍如何使用阿里云容器镜像服务(ACR)部署云端牧场项目。

## 目录

- [环境准备](#环境准备)
- [配置阿里云ACR](#配置阿里云ACR)
- [部署步骤](#部署步骤)
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

### 安装 Docker

**CentOS:**
```bash
# 安装必要工具
sudo yum install -y yum-utils device-mapper-persistent-data lvm2

# 添加Docker源
sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

# 安装Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
```

**Ubuntu:**
```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加Docker官方GPG密钥
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加Docker源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 安装 Docker Compose

```bash
# 下载Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

---

## 配置阿里云ACR

### 1. 登录阿里云ACR镜像仓库

```bash
# 登录镜像仓库
docker login --username=<您的阿里云账号> crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com

# 输入密码后显示 Login Succeeded 表示登录成功
```

### 2. 配置Docker镜像加速器（可选但推荐）

编辑 `/etc/docker/daemon.json`:

```json
{
  "registry-mirrors": [
    "https://crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com"
  ]
}
```

重启Docker服务：
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

---

## 部署步骤

### 步骤一：获取项目代码

```bash
# 创建项目目录
mkdir -p /opt/cloud-ranch
cd /opt/cloud-ranch

# 克隆代码（或上传代码包）
git clone https://github.com/iGewen/renyang-system.git .

# 如果是上传代码包
# 上传后解压
unzip renyang-system.zip
```

### 步骤二：配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑环境变量
vim .env
```

修改以下关键配置：

```env
# MySQL配置（务必修改密码）
MYSQL_ROOT_PASSWORD=YourStrongPassword123!

# JWT配置（务必修改密钥）
JWT_SECRET=your-very-long-and-secure-jwt-secret-key-at-least-32-characters

# 支付宝配置（可选，正式环境需要）
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=your_alipay_private_key

# 微信支付配置（可选，正式环境需要）
WECHAT_APP_ID=your_wechat_app_id
WECHAT_MCH_ID=your_wechat_mch_id
```

### 步骤三：拉取基础镜像

```bash
# 拉取MySQL镜像
docker pull crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/mysql:8.0

# 拉取Redis镜像
docker pull crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/redis:latest

# 验证镜像
docker images | grep ihee_docker_project
```

### 步骤四：启动服务

```bash
# 构建并启动所有服务（首次部署或代码更新后）
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
```

### 步骤五：验证部署

```bash
# 检查所有容器是否正常运行
docker-compose ps

# 应该看到类似输出：
# NAME                    STATUS    PORTS
# cloud-ranch-mysql       running   0.0.0.0:3306->3306/tcp
# cloud-ranch-redis       running   0.0.0.0:6379->6379/tcp
# cloud-ranch-backend     running   0.0.0.0:3001->3001/tcp
# cloud-ranch-frontend    running   0.0.0.0:80->80/tcp

# 测试后端API
curl http://localhost:3001/api/docs

# 测试前端页面
curl http://localhost:80
```

### 步骤六：访问应用

- **前端页面**: http://服务器IP
- **后端API文档**: http://服务器IP:3001/api/docs
- **管理后台**: http://服务器IP/admin

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123456`

**⚠️ 重要：首次登录后请立即修改默认密码！**

---

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart backend

# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql

# 查看最近100行日志
docker-compose logs --tail=100 backend
```

### 数据库操作

```bash
# 进入MySQL容器
docker-compose exec mysql bash

# 连接MySQL
docker-compose exec mysql mysql -u root -p

# 备份数据库
docker-compose exec mysql mysqldump -u root -p cloud_ranch > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker-compose exec -T mysql mysql -u root -p cloud_ranch < backup_20260404.sql
```

### Redis操作

```bash
# 进入Redis容器
docker-compose exec redis bash

# 连接Redis CLI
docker-compose exec redis redis-cli

# 清空Redis缓存
docker-compose exec redis redis-cli FLUSHALL
```

### 更新部署

```bash
# 拉取最新代码
git pull origin dev

# 重新构建并启动
docker-compose up -d --build

# 或者只重新构建后端
docker-compose up -d --build backend

# 或者只重新构建前端
docker-compose up -d --build frontend
```

---

## 故障排查

### 1. 容器无法启动

```bash
# 查看容器日志
docker-compose logs backend

# 查看容器详细信息
docker inspect cloud-ranch-backend

# 检查容器状态
docker-compose ps
```

### 2. MySQL连接失败

```bash
# 检查MySQL是否正常运行
docker-compose ps mysql

# 检查MySQL日志
docker-compose logs mysql

# 手动测试连接
docker-compose exec mysql mysql -u root -p
```

### 3. 前端页面无法访问

```bash
# 检查Nginx配置
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# 检查前端容器日志
docker-compose logs frontend

# 检查端口占用
netstat -tlnp | grep :80
```

### 4. 后端API报错

```bash
# 查看后端日志
docker-compose logs -f backend

# 进入后端容器调试
docker-compose exec backend sh

# 检查环境变量
docker-compose exec backend env | grep DB_
```

### 5. 磁盘空间不足

```bash
# 查看Docker磁盘使用
docker system df

# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune

# 全面清理（慎用）
docker system prune -a --volumes
```

### 6. 重置整个环境

```bash
# 停止并删除所有容器、网络、卷
docker-compose down -v

# 删除所有数据（危险操作！）
docker volume rm cloud-ranch_mysql_data
docker volume rm cloud-ranch_redis_data

# 重新部署
docker-compose up -d --build
```

---

## 安全建议

### 1. 修改默认端口

编辑 `docker-compose.yml`，修改端口映射：

```yaml
services:
  mysql:
    ports:
      - "127.0.0.1:3306:3306"  # 仅本地访问
  backend:
    ports:
      - "127.0.0.1:3001:3001"  # 通过Nginx代理
```

### 2. 配置防火墙

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

### 3. 启用HTTPS

使用Let's Encrypt免费证书：

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu
sudo yum install certbot python3-certbot-nginx  # CentOS

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 4. 定期备份

```bash
# 创建备份脚本
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose -f /opt/cloud-ranch/docker-compose.yml exec -T mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} cloud_ranch > $BACKUP_DIR/db_$DATE.sql

# 保留最近7天的备份
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
EOF

chmod +x /opt/backup.sh

# 添加定时任务
echo "0 2 * * * /opt/backup.sh" | crontab -
```

---

## 附录

### 服务架构图

```
                    ┌─────────────────────────────────────┐
                    │          用户浏览器                   │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │   Frontend (Nginx) - 端口 80        │
                    │   提供静态文件 + API反向代理          │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │   Backend (NestJS) - 端口 3001      │
                    │   业务逻辑 + API服务                  │
                    └──────────┬───────────────┬──────────┘
                               │               │
              ┌────────────────┘               └────────────────┐
              ▼                                                 ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   MySQL 8.0 - 端口 3306     │     │   Redis - 端口 6379         │
│   数据持久化存储              │     │   缓存 + Session            │
└─────────────────────────────┘     └─────────────────────────────┘
```

### 目录结构

```
/opt/cloud-ranch/
├── docker-compose.yml      # Docker编排文件
├── .env                    # 环境变量配置
├── .env.docker            # 环境变量模板
├── README.md              # 项目说明
├── backend/               # 后端代码
│   ├── Dockerfile         # 后端镜像配置
│   ├── src/               # 源代码
│   └── ...
├── frontend/              # 前端代码
│   ├── Dockerfile         # 前端镜像配置
│   ├── nginx.conf         # Nginx配置
│   ├── src/               # 源代码
│   └── ...
└── scripts/               # 脚本文件
    └── init-database.sql  # 数据库初始化
```

### 技术支持

如遇问题，请检查：
1. Docker服务是否正常运行
2. 端口是否被占用
3. 环境变量是否正确配置
4. 日志中的错误信息

---

**文档版本**: v1.0
**更新日期**: 2026-04-04
