# 云端牧场后端 Dockerfile
# 使用阿里云ACR镜像: crpi-h8wdp3y1iogi9wj4.cn-qingdao.personal.cr.aliyuncs.com/ihee_docker_project/node:lts

# 构建阶段
FROM node:lts-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:lts-alpine AS production

WORKDIR /app

# 设置Node环境
ENV NODE_ENV=production

# 复制构建产物和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["node", "dist/main.js"]
