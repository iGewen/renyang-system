#!/bin/sh
# ===========================================
# SSL证书初始化脚本
# 自动申请Let's Encrypt证书并配置HTTPS
# ===========================================

set -e

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
STAGING="${STAGING:-0}"

# 安全修复 (I-M09): 域名格式验证，防止注入攻击
validate_domain() {
    local domain="$1"
    # 域名正则：允许字母、数字、连字符和点，最多253字符
    # 不允许特殊字符如 ; | & $ ` 等
    if [ -z "$domain" ]; then
        return 0  # 空域名允许，使用HTTP模式
    fi

    # 检查长度
    if [ ${#domain} -gt 253 ]; then
        echo "错误: 域名长度超过253字符"
        return 1
    fi

    # 检查格式：只允许合法的域名字符
    # 域名格式：字母数字开头，可包含连字符和点，以字母数字结尾
    # 每个标签最多63字符
    if ! echo "$domain" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$'; then
        echo "错误: 域名格式无效 '$domain'"
        echo "域名只能包含字母、数字、连字符和点"
        return 1
    fi

    # 检查每个标签长度不超过63字符
    local IFS='.'
    for label in $domain; do
        if [ ${#label} -gt 63 ]; then
            echo "错误: 域名标签 '$label' 超过63字符"
            return 1
        fi
    done

    return 0
}

# 验证域名格式
if [ -n "$DOMAIN" ]; then
    if ! validate_domain "$DOMAIN"; then
        echo "域名验证失败，使用HTTP模式"
        exit 0
    fi
fi

# 配置HTTPS函数
configure_https() {
    echo "切换到HTTPS配置..."

    # 生成HTTPS配置文件
    cat > /etc/nginx/conf.d/https.conf << EOF
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS服务器
server {
    listen 443 ssl;
    http2 on;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # 安全修复 (I-M11): OCSP Stapling 提升SSL握手性能和隐私
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_stapling_responder http://r3.o.lencr.org;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

    echo "HTTPS配置完成"
}

# 检查域名是否配置
if [ -z "$DOMAIN" ]; then
    echo "=========================================="
    echo "未配置 DOMAIN，使用HTTP模式"
    echo "=========================================="
    exit 0
fi

echo "=========================================="
echo "开始配置SSL证书"
echo "域名: $DOMAIN"
echo "邮箱: $EMAIL"
echo "=========================================="

# 检查证书是否已存在（检查目录和证书文件）
if [ -d "/etc/letsencrypt/live/$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    echo "=========================================="
    echo "证书已存在，跳过申请"
    echo "证书路径: /etc/letsencrypt/live/$DOMAIN"
    echo "=========================================="
    configure_https
    exit 0
fi

# 检查目录存在但证书文件不完整的情况
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "警告: 证书目录存在但证书文件不完整，将重新申请"
    rm -rf "/etc/letsencrypt/live/$DOMAIN"
fi

# 等待nginx启动
echo "等待Nginx启动..."
sleep 10

# 测试域名解析
echo "测试域名解析..."
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    echo "警告: 无法解析域名 $DOMAIN"
fi

# 申请证书
echo "申请SSL证书..."
CERTBOT_ARGS="certonly --webroot -w /var/www/certbot --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN"

if [ "$STAGING" = "1" ]; then
    CERTBOT_ARGS="$CERTBOT_ARGS --test-cert"
    echo "使用测试模式申请证书"
fi

certbot $CERTBOT_ARGS || {
    echo "=========================================="
    echo "证书申请失败！"
    echo "请检查："
    echo "  1. 域名 $DOMAIN 是否正确解析到服务器IP"
    echo "  2. 服务器80端口是否对外开放"
    echo "  3. 阿里云安全组是否开放80端口"
    echo "=========================================="
    echo "当前使用HTTP模式运行"
    exit 0
}

echo "=========================================="
echo "SSL证书申请成功！"
echo "=========================================="

# 配置HTTPS
configure_https

# 重启nginx容器以加载新配置
echo "请重启frontend容器: docker restart cloud-ranch-frontend"

exit 0
