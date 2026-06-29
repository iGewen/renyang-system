import { registerAs } from '@nestjs/config';

export const wechatConfig = registerAs('wechatLogin', () => ({
  appId: process.env.WECHATLOGIN_APPID || '',
  appSecret: process.env.WECHATLOGIN_APPSECRET || '',
}));
