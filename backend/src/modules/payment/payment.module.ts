import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRecord, Order, User, BalanceLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { ServicesModule } from '@/services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord, Order, User, BalanceLog]),
    UserModule,
    OrderModule,
    ServicesModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, RedisService],
  exports: [PaymentService],
})
export class PaymentModule {}
