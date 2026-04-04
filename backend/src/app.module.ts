import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// 配置
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { jwtConfig } from './config/jwt.config';

// 模块
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { LivestockModule } from './modules/livestock/livestock.module';
import { OrderModule } from './modules/order/order.module';
import { AdoptionModule } from './modules/adoption/adoption.module';
import { FeedModule } from './modules/feed/feed.module';
import { RedemptionModule } from './modules/redemption/redemption.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RefundModule } from './modules/refund/refund.module';
import { BalanceModule } from './modules/balance/balance.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { ServicesModule } from './services/services.module';
import { TasksModule } from './tasks/tasks.module';
import { UploadModule } from './modules/upload/upload.module';

// 守卫
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

// 日志
import { AppLogger, LoggerMiddleware } from './common/logger';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [databaseConfig, redisConfig, jwtConfig],
    }),

    // 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/entities/**/*.entity{.ts,.js}', __dirname + '/entities/*{.ts,.js}'],
        synchronize: true, // 生产环境首次部署后建议设为 false
        logging: configService.get('NODE_ENV') === 'development',
        charset: 'utf8mb4',
      }),
      inject: [ConfigService],
    }),

    // 定时任务模块
    ScheduleModule.forRoot(),

    // JWT模块
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 服务模块
    ServicesModule,

    // 业务模块
    AuthModule,
    UserModule,
    LivestockModule,
    OrderModule,
    AdoptionModule,
    FeedModule,
    RedemptionModule,
    PaymentModule,
    RefundModule,
    BalanceModule,
    NotificationModule,
    AdminModule,
    UploadModule,

    // 定时任务模块
    TasksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    AppLogger,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
