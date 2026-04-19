import { registerAs } from '@nestjs/config';
import { SecretUtil } from '@/common/utils/secret.util';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: SecretUtil.read('REDIS_PASSWORD') || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
}));
