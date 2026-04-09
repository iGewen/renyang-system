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
    echo "警告: 未配置 DOMAIN，跳过SSL证书申请"
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
sleep 10

# 测试域名是否可访问（简单检查）
echo "准备申请证书..."

# 构建certbot参数
if [ "$STAGING" = "1" ]; then
    CERTBOT_ARGS="--test-cert"
    echo "使用测试模式申请证书"
else
    CERTBOT_ARGS=""
fi

# 申请证书
echo "申请SSL证书..."
certbot certonly --webroot \
    -w /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $CERTBOT_ARGS \
    -d "$DOMAIN" || {
    echo "证书申请失败，请检查:"
    echo "  1. 域名是否正确解析到服务器IP"
    echo "  2. 服务器80端口是否可访问"
    echo "继续使用HTTP模式运行..."
    exit 0
}

echo "=========================================="
echo "SSL证书申请成功！"
echo "=========================================="

# 切换到HTTPS配置
if [ -f "/etc/nginx/templates/nginx.https.conf.template" ]; then
    echo "切换到HTTPS配置..."
    envsubst '${DOMAIN}' < /etc/nginx/templates/nginx.https.conf.template > /etc/nginx/conf.d/default.conf
fi

exit 0
