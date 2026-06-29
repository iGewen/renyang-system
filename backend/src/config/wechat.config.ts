import { registerAs } from '@nestjs/config';

export const wechatConfig = registerAs('wechatLogin', () => ({
  appId: process.env.WECHATLOGIN_APPID || '',
  appSecret: process.env.WECHATLOGIN_APPSECRET || '',
}));

export const wechatPayConfig = registerAs('wechat', () => ({
  appId: process.env.WECHAT_APPID || '',
  appSecret: process.env.WECHAT_APPSECRET || '',
  notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
}));
