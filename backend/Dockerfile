# 云端牧场后端 Dockerfile
# 多阶段构建，自动安装依赖并编译

# 阶段1: 构建阶段
FROM node:lts-alpine AS builder

WORKDIR /app

# 安装构建工具（某些依赖需要编译）
RUN apk add --no-cache python3 make g++

# 复制package文件
COPY package*.json ./

# 安装所有依赖（包括devDependencies用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 清理devDependencies，只保留生产依赖
RUN npm prune --production

# 阶段2: 生产阶段
FROM node:lts-alpine AS production

WORKDIR /app

# 设置Node环境
ENV NODE_ENV=production

# 复制构建产物和生产依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/docs || exit 1

# 启动应用
CMD ["node", "dist/main.js"]
