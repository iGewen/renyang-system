# 云端牧场前端 Dockerfile
# 多阶段构建，自动安装依赖、构建并部署到Nginx

# 阶段1: 构建阶段
FROM node:lts-alpine AS builder

WORKDIR /app

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 阶段2: 生产阶段 - Nginx提供静态文件服务
FROM nginx:alpine AS production

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
