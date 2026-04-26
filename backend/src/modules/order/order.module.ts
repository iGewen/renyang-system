import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderStateService } from './order-state.service';
import { Order, OrderHistory, User, Livestock, Adoption, SmsCode, SystemConfig } from '@/entities';
import { LivestockModule } from '../livestock/livestock.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderHistory, User, Livestock, Adoption, SmsCode, SystemConfig]),
    LivestockModule,
    NotificationModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderStateService],
  exports: [OrderService, OrderStateService],
})
export class OrderModule {}
