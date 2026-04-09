# 云端牧场前端 Dockerfile
# 多阶段构建，自动安装依赖、构建并部署到Nginx
# 支持自动HTTPS切换

# 阶段1: 构建阶段
FROM node:lts-alpine AS builder

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 复制package文件
COPY package*.json ./

# 使用淘宝npm镜像加速，删除lock文件避免版本冲突
RUN npm config set registry https://registry.npmmirror.com && rm -f package-lock.json && npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 阶段2: 生产阶段 - Nginx提供静态文件服务
FROM nginx:alpine AS production

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装必要工具
RUN apk add --no-cache curl inotify-tools

# 创建必要目录
RUN mkdir -p /var/www/certbot /etc/letsencrypt /etc/nginx/conf.d

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置（HTTP模式默认配置）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制配置监听脚本（内联创建）
RUN echo '#!/bin/sh' > /usr/local/bin/watch-config.sh && \
    echo 'CONF_DIR="/etc/nginx/conf.d"' >> /usr/local/bin/watch-config.sh && \
    echo 'HTTPS_CONF="https.conf"' >> /usr/local/bin/watch-config.sh && \
    echo 'echo "配置监听服务启动..."' >> /usr/local/bin/watch-config.sh && \
    echo 'while true; do' >> /usr/local/bin/watch-config.sh && \
    echo '    if [ -f "$CONF_DIR/$HTTPS_CONF" ]; then' >> /usr/local/bin/watch-config.sh && \
    echo '        if nginx -t 2>/dev/null; then' >> /usr/local/bin/watch-config.sh && \
    echo '            echo "检测到HTTPS配置，重载Nginx..."' >> /usr/local/bin/watch-config.sh && \
    echo '            nginx -s reload' >> /usr/local/bin/watch-config.sh && \
    echo '            echo "Nginx已切换到HTTPS模式"' >> /usr/local/bin/watch-config.sh && \
    echo '            exit 0' >> /usr/local/bin/watch-config.sh && \
    echo '        fi' >> /usr/local/bin/watch-config.sh && \
    echo '    fi' >> /usr/local/bin/watch-config.sh && \
    echo '    sleep 5' >> /usr/local/bin/watch-config.sh && \
    echo 'done' >> /usr/local/bin/watch-config.sh && \
    chmod +x /usr/local/bin/watch-config.sh

# 创建启动脚本（内联创建）
RUN echo '#!/bin/sh' > /docker-entrypoint-wrapper.sh && \
    echo '/usr/local/bin/watch-config.sh &' >> /docker-entrypoint-wrapper.sh && \
    echo 'exec /docker-entrypoint.sh "$@"' >> /docker-entrypoint-wrapper.sh && \
    chmod +x /docker-entrypoint-wrapper.sh

# 暴露端口
EXPOSE 80 443

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

ENTRYPOINT ["/docker-entrypoint-wrapper.sh"]
CMD ["nginx", "-g", "daemon off;"]
