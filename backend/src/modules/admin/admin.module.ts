import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  Admin,
  User,
  Order,
  Livestock,
  LivestockType,
  Adoption,
  FeedBill,
  RedemptionOrder,
  RefundOrder,
  Notification,
  SystemConfig,
  AuditLog,
} from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      User,
      Order,
      Livestock,
      LivestockType,
      Adoption,
      FeedBill,
      RedemptionOrder,
      RefundOrder,
      Notification,
      SystemConfig,
      AuditLog,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, RedisService],
  exports: [AdminService],
})
export class AdminModule {}
