# 自动HTTPS部署指南

本项目支持自动申请和续签Let's Encrypt SSL证书，全程无需手动操作。

## 快速开始

### 1. 配置环境变量

```bash
# 复制环境配置文件
cp .env.docker .env

# 编辑配置文件
nano .env
```

**必填配置项：**
```env
# 域名（必须正确解析到服务器IP）
DOMAIN=your-domain.com

# 邮箱（用于证书到期提醒）
EMAIL=your-email@example.com

# MySQL密码（务必修改）
MYSQL_ROOT_PASSWORD=your_strong_password

# JWT密钥（务必修改）
JWT_SECRET=your-very-long-jwt-secret-key
```

### 2. 启动服务

```bash
# 使用HTTPS模式启动
docker compose -f docker-compose.https.yml up -d
```

### 3. 验证部署

- HTTP访问会自动跳转到HTTPS
- 证书自动申请，首次启动可能需要等待1-2分钟
- 证书到期前自动续签，无需人工干预

## 工作原理

```
┌─────────────────────────────────────────────────────────┐
│                      用户请求                            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Nginx (frontend)                       │
│  - 80端口: HTTP请求重定向到HTTPS                         │
│  - 443端口: HTTPS服务                                    │
│  - Let's Encrypt验证路径                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐          ┌───────────────┐
│    Backend    │          │    Certbot    │
│   (API服务)    │          │  (证书管理)    │
│   端口: 3001   │          │  自动续签证书  │
└───────────────┘          └───────────────┘
```

## 首次部署流程

1. **启动服务** → Nginx以HTTP模式启动
2. **证书申请** → Certbot自动申请证书
3. **自动切换** → 证书申请成功后，重启Nginx启用HTTPS
4. **自动续签** → Certbot每天检查证书，到期前自动续签

## 配置说明

### 域名要求

- 域名必须正确解析到服务器IP
- 服务器80端口必须可访问（用于证书验证）
- 服务器443端口必须可访问（用于HTTPS服务）

### 测试模式

首次部署建议开启测试模式，避免频繁申请被限制：

```env
STAGING=1
```

测试通过后，改为正式模式：
```env
STAGING=0
```

### 不使用HTTPS

如果不需要HTTPS，使用原有的docker-compose.yml：

```bash
docker compose up -d
```

## 常见问题

### Q: 证书申请失败？

检查：
1. 域名是否正确解析到服务器IP
2. 服务器防火墙是否开放80端口
3. 是否开启了测试模式（STAGING=1）

查看日志：
```bash
docker compose -f docker-compose.https.yml logs certbot
```

### Q: 如何手动续签证书？

```bash
docker compose -f docker-compose.https.yml exec certbot certbot renew
docker compose -f docker-compose.https.yml restart frontend
```

### Q: 如何查看证书状态？

```bash
docker compose -f docker-compose.https.yml exec certbot certbot certificates
```

### Q: 证书存储在哪里？

证书存储在Docker卷中：
- `certbot_letsencrypt`: 证书文件
- `certbot_www`: ACME验证文件

## 文件说明

```
项目根目录/
├── docker-compose.https.yml  # HTTPS模式部署配置
├── docker-compose.yml        # HTTP模式部署配置
├── .env.docker               # 环境变量模板
├── nginx/
│   ├── nginx.conf.template   # Nginx配置模板
│   ├── start-nginx.sh        # Nginx启动脚本
│   ├── init-letsencrypt.sh   # 证书初始化脚本
│   └── renew-certs.sh        # 证书续签脚本
└── certbot/
    └── Dockerfile            # Certbot镜像配置
```

## 生产环境建议

1. **修改所有默认密码**
2. **设置强JWT密钥**（至少32位随机字符串）
3. **关闭测试模式**（STAGING=0）
4. **配置服务器防火墙**（只开放80、443、SSH端口）
5. **定期备份数据库**
