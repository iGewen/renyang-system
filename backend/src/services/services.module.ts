import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { WechatService } from './wechat.service';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { User, SmsCode, SystemConfig } from '@/entities';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/utils/redis.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, SmsCode, SystemConfig]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SmsService, WechatService, AlipayService, WechatPayService, RedisService],
  exports: [SmsService, WechatService, AlipayService, WechatPayService],
})
export class ServicesModule {}
