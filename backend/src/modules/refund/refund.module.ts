import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RefundOrder, Order, Adoption, User, BalanceLog, PaymentRecord } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { ServicesModule } from '@/services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefundOrder, Order, Adoption, User, BalanceLog, PaymentRecord]),
    UserModule,
    NotificationModule,
    ServicesModule,
  ],
  controllers: [RefundController],
  providers: [RefundService, RedisService],
  exports: [RefundService],
})
export class RefundModule {}
