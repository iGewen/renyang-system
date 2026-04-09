#!/bin/sh
# ===========================================
# SSL证书初始化脚本
# 自动申请Let's Encrypt证书
# ===========================================

set -e

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
STAGING="${STAGING:-0}"

# 检查域名是否配置
if [ -z "$DOMAIN" ]; then
    echo "警告: 未配置 DOMAIN，跳过SSL证书申请，使用HTTP模式"
    exit 0
fi

echo "=========================================="
echo "开始配置SSL证书"
echo "域名: $DOMAIN"
echo "邮箱: $EMAIL"
echo "=========================================="

# 检查证书是否已存在
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "证书已存在，跳过申请"
    exit 0
fi

# 等待nginx启动
echo "等待Nginx启动..."
sleep 5

# 测试域名是否可访问
echo "测试域名解析..."
if ! nc -z $DOMAIN 80 2>/dev/null; then
    echo "警告: 域名 $DOMAIN 无法访问，请确保:"
    echo "  1. 域名已正确解析到服务器IP"
    echo "  2. 服务器80端口可访问"
    echo "跳过SSL证书申请"
    exit 0
fi

# 构建certbot参数
CERTBOT_ARGS="certonly --webroot -w /var/www/certbot --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN"

# 测试模式（不实际申请证书）
if [ "$STAGING" = "1" ]; then
    CERTBOT_ARGS="$CERTBOT_ARGS --test-cert"
    echo "使用测试模式申请证书"
fi

# 申请证书
echo "申请SSL证书..."
certbot $CERTBOT_ARGS || {
    echo "证书申请失败，请检查域名配置"
    exit 1
}

echo "=========================================="
echo "SSL证书申请成功！"
echo "=========================================="

# 重新加载nginx
echo "重新加载Nginx配置..."
nginx -s reload || true

exit 0
