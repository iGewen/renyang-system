import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES, QUEUE_CONFIG } from './queue.constants';
import { NotificationProcessor } from './notification.processor';
import { RefundProcessor } from './refund.processor';
import { DelayedTasksProcessor } from './delayed-tasks.processor';
import { QueueService } from './queue.service';
import { QueueEventListener } from './queue.event-listener';
import { NotificationModule } from '@/modules/notification/notification.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { OrderModule } from '@/modules/order/order.module';
import { RedemptionModule } from '@/modules/redemption/redemption.module';
import { RedisService } from '@/common/utils/redis.service';
import { RefundOrder, Order, Adoption, RedemptionOrder } from '@/entities';

@Module({
  imports: [
    // BullMQ Redis 连接配置
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host', 'localhost'),
          port: configService.get('redis.port', 6379),
          password: configService.get('redis.password', undefined) || undefined,
          db: configService.get('redis.db', 0),
        },
      }),
      inject: [ConfigService],
    }),

    // 注册队列
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.NOTIFICATION,
        ...QUEUE_CONFIG[QUEUE_NAMES.NOTIFICATION],
      },
      {
        name: QUEUE_NAMES.REFUND_PROCESS,
        ...QUEUE_CONFIG[QUEUE_NAMES.REFUND_PROCESS],
      },
      {
        name: QUEUE_NAMES.DELAYED_TASKS,
        ...QUEUE_CONFIG[QUEUE_NAMES.DELAYED_TASKS],
      },
    ),

    // 队列处理器需要的实体
    TypeOrmModule.forFeature([RefundOrder, Order, Adoption, RedemptionOrder]),

    // 依赖的业务模块
    NotificationModule,
    PaymentModule,
    OrderModule,
    RedemptionModule,
  ],
  providers: [
    NotificationProcessor,
    RefundProcessor,
    DelayedTasksProcessor,
    QueueService,
    QueueEventListener,
    RedisService,
  ],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
