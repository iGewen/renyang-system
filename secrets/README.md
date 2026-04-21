# Secrets Directory
此目录包含敏感密钥文件，由 secrets-init 服务自动管理。

文件说明：
- jwt_secret.txt: JWT 令牌签名密钥
- db_password.txt: 数据库连接密码
- redis_password.txt: Redis 连接密码
- encryption_key.txt: 数据加密密钥

注意：
1. 这些文件会在首次部署时被 secrets-init 从 .env 读取并覆盖
2. 请勿手动编辑这些文件
3. 确保 .env 文件中配置了正确的密码
