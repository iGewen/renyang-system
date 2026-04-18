import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('JwtConfig');

export const jwtConfig = registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;

  // 强制要求配置 JWT_SECRET，不允许使用默认值
  if (!secret) {
    logger.error('JWT_SECRET 环境变量未配置，请在 .env 文件中设置（至少32位随机字符串）');
    throw new Error('JWT_SECRET 环境变量未配置，服务无法启动');
  }

  // 验证密钥长度
  if (secret.length < 32) {
    logger.error(`JWT_SECRET 长度不足32位，当前长度: ${secret.length}`);
    throw new Error('JWT_SECRET 长度必须至少32位');
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
});
