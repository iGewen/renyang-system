import { Module, forwardRef } from '@nestjs/common';
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
  PaymentRecord,
} from '@/entities';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from '../notification/notification.module';
import { ServicesModule } from '@/services/services.module';
import { OrderModule } from '../order/order.module';
import { RedisService } from '@/common/utils/redis.service';
import {
  AdminUserService,
  AdminLivestockService,
  AdminOrderService,
  AdminAdoptionService,
  AdminFeedService,
  AdminRedemptionService,
  AdminRefundService,
  AdminConfigBasicService,
  AdminNotificationService,
  AdminAgreementService,
  AdminExportService,
  AdminManagementService,
} from './services';
import {
  AdminUserController,
  AdminLivestockController,
  AdminOrderController,
  AdminSystemController,
} from './controllers';
import type { StringValue } from 'ms';

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
      PaymentRecord,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET 未配置，请检查环境变量');
        }
        const expiresIn = (configService.get<string>('jwt.expiresIn') || '2h') as StringValue;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    forwardRef(() => NotificationModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => OrderModule),
  ],
  controllers: [
    AdminController,
    AdminUserController,
    AdminLivestockController,
    AdminOrderController,
    AdminSystemController,
  ],
  providers: [
    AdminService,
    AdminGuard,
    RedisService,
    AdminUserService,
    AdminLivestockService,
    AdminOrderService,
    AdminAdoptionService,
    AdminFeedService,
    AdminRedemptionService,
    AdminRefundService,
    AdminConfigBasicService,
    AdminNotificationService,
    AdminAgreementService,
    AdminExportService,
    AdminManagementService,
  ],
  exports: [
    AdminService,
    AdminUserService,
    AdminLivestockService,
    AdminOrderService,
    AdminAdoptionService,
    AdminFeedService,
    AdminRedemptionService,
    AdminRefundService,
    AdminConfigBasicService,
    AdminNotificationService,
    AdminAgreementService,
    AdminExportService,
    AdminManagementService,
  ],
})
export class AdminModule {}
