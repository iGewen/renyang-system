#!/bin/bash

# Docker Secrets 初始化脚本
# 安全修复 (I-C04): 创建 Docker secrets 文件
#
# 使用方式：
#   chmod +x scripts/init-secrets.sh
#   ./scripts/init-secrets.sh

set -e

SECRETS_DIR="./secrets"

echo "=== Docker Secrets 初始化脚本 ==="
echo ""

# 创建 secrets 目录
if [ ! -d "$SECRETS_DIR" ]; then
    mkdir -p "$SECRETS_DIR"
    echo "✓ 创建目录: $SECRETS_DIR"
fi

# 生成随机密钥的函数
generate_secret() {
    openssl rand -hex 24
}

# 创建或更新 secret 文件
create_secret_file() {
    local name=$1
    local file="$SECRETS_DIR/${name}.txt"

    if [ -f "$file" ]; then
        echo "⚠ 文件已存在: $file"
        read -p "  是否覆盖？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "  跳过 $name"
            return
        fi
    fi

    echo -n "$(generate_secret)" > "$file"
    chmod 600 "$file"
    echo "✓ 创建文件: $file"
}

# 创建各个 secret 文件
echo "正在生成 secrets..."
echo ""

create_secret_file "jwt_secret"
create_secret_file "db_password"
create_secret_file "redis_password"
create_secret_file "encryption_key"

# 创建 .gitignore 确保 secrets 不被提交
SECRETS_GITIGNORE="$SECRETS_DIR/.gitignore"
if [ ! -f "$SECRETS_GITIGNORE" ]; then
    echo "# 此目录包含敏感信息，不要提交到 Git" > "$SECRETS_GITIGNORE"
    echo "*" >> "$SECRETS_GITIGNORE"
    echo "!.gitignore" >> "$SECRETS_GITIGNORE"
    echo "✓ 创建文件: $SECRETS_GITIGNORE"
fi

echo ""
echo "=== 完成 ==="
echo ""
echo "重要提示:"
echo "1. secrets/ 目录已添加到 .gitignore，不会被提交到 Git"
echo "2. 部署前请确保 secrets 目录权限正确: chmod 700 $SECRETS_DIR"
echo "3. 生产环境请使用更强的密钥，或从安全存储服务获取"
echo ""
echo "文件列表:"
ls -la "$SECRETS_DIR"
