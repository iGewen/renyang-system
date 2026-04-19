import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '@/common/guards/admin.guard';
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
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET 未配置，请检查环境变量');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('jwt.expiresIn') || '2h',
          },
        };
      },
      inject: [ConfigService],
    }),
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
