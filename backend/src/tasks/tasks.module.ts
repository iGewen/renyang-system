import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { FeedModule } from '@/modules/feed/feed.module';
import { OrderModule } from '@/modules/order/order.module';
import { AdoptionModule } from '@/modules/adoption/adoption.module';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    FeedModule,
    OrderModule,
    AdoptionModule,
  ],
  providers: [TasksService, RedisService],
})
export class TasksModule {}
