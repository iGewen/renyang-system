#!/bin/sh
# ===========================================
# Nginx启动脚本
# 根据是否配置域名自动选择HTTP或HTTPS模式
# ===========================================

set -e

DOMAIN="${DOMAIN:-}"
NGINX_CONF="/etc/nginx/conf.d/default.conf"

echo "=========================================="
echo "Nginx启动配置"
echo "域名: ${DOMAIN:-未配置}"
echo "=========================================="

if [ -z "$DOMAIN" ]; then
    echo "未配置DOMAIN，使用HTTP模式"

    # 创建简单的HTTP配置
    cat > $NGINX_CONF << 'EOF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml application/x-javascript;
    gzip_comp_level 6;

    # 静态资源缓存
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API代理到后端
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 错误页面
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

else
    echo "已配置DOMAIN，检查SSL证书..."

    # 复制模板配置
    cp /etc/nginx/templates/nginx.conf.template $NGINX_CONF

    # 替换域名占位符
    sed -i "s/__DOMAIN__/$DOMAIN/g" $NGINX_CONF

    # 检查证书是否存在
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    if [ ! -f "$CERT_PATH" ]; then
        echo "SSL证书不存在，使用HTTP模式（证书申请后自动切换HTTPS）"

        # 注释掉HTTPS配置，只保留HTTP
        cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Let's Encrypt验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    root /usr/share/nginx/html;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml application/x-javascript;
    gzip_comp_level 6;

    # 静态资源缓存
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API代理到后端
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

    # SPA路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 错误页面
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF
    else
        echo "SSL证书已存在，启用HTTPS模式"
    fi
fi

echo "启动Nginx..."
exec nginx -g 'daemon off;'
