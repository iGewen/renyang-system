#!/bin/sh
# ===========================================
# Nginx配置监听和自动重载脚本
# 监听/etc/nginx/conf.d/目录变化，自动重载nginx
# ===========================================

CONF_DIR="/etc/nginx/conf.d"
HTTPS_CONF="https.conf"
CHECK_INTERVAL=5

echo "配置监听服务启动..."

while true; do
    # 检查是否存在HTTPS配置文件
    if [ -f "$CONF_DIR/$HTTPS_CONF" ]; then
        # 测试nginx配置是否有效
        if nginx -t 2>/dev/null; then
            echo "检测到HTTPS配置，重载Nginx..."
            nginx -s reload
            echo "Nginx已切换到HTTPS模式"
            # 重载成功后退出监听（HTTPS已启用）
            exit 0
        else
            echo "HTTPS配置文件存在但配置无效，等待..."
        fi
    fi

    sleep $CHECK_INTERVAL
done
