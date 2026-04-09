import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { WechatService } from './wechat.service';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { User, SmsCode, SystemConfig } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, SmsCode, SystemConfig]),
  ],
  providers: [SmsService, WechatService, AlipayService, WechatPayService, RedisService],
  exports: [SmsService, WechatService, AlipayService, WechatPayService],
})
export class ServicesModule {}
