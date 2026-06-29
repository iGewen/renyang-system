import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  url: process.env.APP_URL || 'https://ry.yunong.icu',
}));
