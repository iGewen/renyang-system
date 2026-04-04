# 云端牧场前端 Dockerfile
# 多阶段构建，自动安装依赖、构建并部署到Nginx

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

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
