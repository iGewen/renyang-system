import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SecretUtil } from '@/common/utils/secret.util';

const logger = new Logger('JwtConfig');

export const jwtConfig = registerAs('jwt', () => {
  let secret: string;

  try {
    secret = SecretUtil.readOrThrow('JWT_SECRET', 32);
  } catch (error) {
    // 生产环境必须配置，开发环境会自动生成
    logger.error(error.message);
    throw error;
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  };
});
