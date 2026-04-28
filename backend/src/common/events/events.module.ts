import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderHistory, RefundOrder } from '@/entities';
import { OrderRefundEventHandler } from './order-refund.handler';
import { NotificationModule } from '@/modules/notification/notification.module';
import { QueueModule } from '@/queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderHistory, RefundOrder]),
    NotificationModule,
    QueueModule,
  ],
  providers: [OrderRefundEventHandler],
  exports: [OrderRefundEventHandler],
})
export class EventsModule {}
