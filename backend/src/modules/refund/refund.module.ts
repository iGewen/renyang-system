import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RefundOrder, Order, Adoption, User, BalanceLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefundOrder, Order, Adoption, User, BalanceLog]),
    UserModule,
    NotificationModule,
  ],
  controllers: [RefundController],
  providers: [RefundService, RedisService],
  exports: [RefundService],
})
export class RefundModule {}
