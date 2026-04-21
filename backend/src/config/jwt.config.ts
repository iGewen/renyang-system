import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('JwtConfig');

export const jwtConfig = registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    logger.error('JWT_SECRET 未配置，请设置环境变量');
    throw new Error('JWT_SECRET 未配置，请设置环境变量');
  }

  if (secret.length < 32) {
    logger.warn(`JWT_SECRET 长度建议至少32位，当前长度: ${secret.length}`);
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
});
