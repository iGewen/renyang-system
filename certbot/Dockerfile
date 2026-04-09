# ===========================================
# Certbot Dockerfile - SSL证书管理
# ===========================================

FROM certbot/certbot:latest

# 安装额外工具
RUN apk add --no-cache curl

# 复制脚本
COPY nginx/init-letsencrypt.sh /opt/init-letsencrypt.sh
COPY nginx/renew-certs.sh /opt/renew-certs.sh
RUN chmod +x /opt/init-letsencrypt.sh /opt/renew-certs.sh

# 创建证书续期定时任务
RUN echo "0 3 * * * /opt/renew-certs.sh >> /var/log/certbot.log 2>&1" > /etc/crontabs/root

# 创建日志目录
RUN mkdir -p /var/log

# 启动crond守护进程
CMD ["crond", "-f", "-l", "2"]
