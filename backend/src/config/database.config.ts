import { registerAs } from '@nestjs/config';
import { SecretUtil } from '@/common/utils/secret.util';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: SecretUtil.read('DB_PASSWORD') || '',
  database: process.env.DB_DATABASE || 'cloud_ranch',
}));
