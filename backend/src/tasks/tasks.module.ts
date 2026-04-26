import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { FeedModule } from '@/modules/feed/feed.module';
import { OrderModule } from '@/modules/order/order.module';
import { AdoptionModule } from '@/modules/adoption/adoption.module';
import { RedemptionModule } from '@/modules/redemption/redemption.module';
import { ServicesModule } from '@/services/services.module';
import { RefundCompensationService } from '@/services/refund-compensation.service';
import { RefundOrder, Order } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([RefundOrder, Order]),
    FeedModule,
    OrderModule,
    AdoptionModule,
    RedemptionModule,
    ServicesModule,
  ],
  providers: [TasksService, RefundCompensationService, RedisService],
})
export class TasksModule {}
