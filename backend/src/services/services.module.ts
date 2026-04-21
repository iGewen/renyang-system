import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { WechatService } from './wechat.service';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { User, SmsCode, SystemConfig } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, SmsCode, SystemConfig]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        const expiresIn = (configService.get<string>('jwt.expiresIn') || '2h') as StringValue;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [SmsService, WechatService, AlipayService, WechatPayService, RedisService],
  exports: [SmsService, WechatService, AlipayService, WechatPayService, RedisService],
})
export class ServicesModule {}
