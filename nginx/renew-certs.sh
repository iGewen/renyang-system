#!/bin/sh
# ===========================================
# SSL证书续期脚本
# 由cron定时调用，自动续期证书
# ===========================================

set -e

DOMAIN="${DOMAIN:-}"

# 检查域名是否配置
if [ -z "$DOMAIN" ]; then
    echo "未配置DOMAIN，跳过证书续期"
    exit 0
fi

# 检查证书是否存在
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "证书不存在，跳过续期"
    exit 0
fi

echo "检查证书续期..."
certbot renew --webroot -w /var/www/certbot --quiet || true

# 重新加载nginx
echo "重新加载Nginx..."
nginx -s reload || true

exit 0
