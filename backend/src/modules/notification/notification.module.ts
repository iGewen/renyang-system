import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification, User } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { ServicesModule } from '@/services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    ServicesModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, RedisService],
  exports: [NotificationService],
})
export class NotificationModule {}
