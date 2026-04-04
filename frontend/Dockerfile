# 云端牧场前端 Dockerfile
# 使用阿里云ACR镜像: crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/node:lts

# 构建阶段
FROM node:lts-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段 - 使用Nginx提供静态文件服务
FROM nginx:alpine AS production

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
