#!/bin/sh
# ===========================================
# Frontend容器启动脚本
# 同时启动nginx和配置监听进程
# ===========================================

# 后台启动配置监听
/usr/local/bin/watch-config.sh &

# 执行原始的nginx入口点
exec /docker-entrypoint.sh "$@"
