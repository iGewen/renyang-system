# 云端牧场后端 Dockerfile
# 多阶段构建，自动安装依赖并编译

# 阶段1: 构建阶段
# 安全修复 (I-M04): 使用具体版本而非 lts 浮动标签，保证构建可复现
FROM node:20-alpine AS builder

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

# 安装构建工具（某些依赖需要编译）
RUN apk add --no-cache python3 make g++

# 复制package文件
COPY package*.json ./

# 使用淘宝npm镜像加速，并忽略peer依赖冲突
RUN npm config set registry https://registry.npmmirror.com && npm ci --legacy-peer-deps

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 清理devDependencies，只保留生产依赖
RUN npm prune --production --legacy-peer-deps

# 阶段2: 生产阶段
FROM node:20-alpine AS production

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安全修复：创建非 root 用户运行应用
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 安装curl用于健康检查
RUN apk add --no-cache curl

WORKDIR /app

# 设置Node环境
ENV NODE_ENV=production

# 复制构建产物和生产依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 安全修复：设置文件所有权给非 root 用户
RUN chown -R appuser:appgroup /app

# 暴露端口
EXPOSE 3001

# 健康检查（使用根路由）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3001/api/ || exit 1

# 安全修复：切换到非 root 用户
USER appuser

# 启动应用
CMD ["node", "dist/main.js"]
