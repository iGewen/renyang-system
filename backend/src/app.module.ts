import { Module, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

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
import { HealthModule } from './modules/health/health.module';

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
        synchronize: false, // 生产环境关闭自动同步，避免数据冲突
        logging: configService.get('NODE_ENV') === 'development',
        charset: 'utf8mb4',
        extra: {
          charset: 'utf8mb4',
          connectionLimit: 10,
        },
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
    HealthModule,

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
export class AppModule implements NestModule, OnModuleInit {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }

  async onModuleInit() {
    // 验证必要的环境变量
    this.validateEnvironment();
    await this.initializeAdmin();
    await this.initializeSystemConfig();
  }

  private validateEnvironment() {
    const requiredEnvVars = ['JWT_SECRET'];
    const missing: string[] = [];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      console.error('❌ 缺少必要的环境变量:');
      missing.forEach(v => console.error(`   - ${v}`));
      console.error('请在 .env 文件中配置这些变量后重新启动');
      throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`);
    }

    // 检查JWT_SECRET长度
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      console.warn('⚠️  JWT_SECRET 长度建议至少32位，当前长度: ' + process.env.JWT_SECRET.length);
    }
  }

  private async initializeAdmin() {
    try {
      const result = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM admins WHERE username = ?',
        ['admin']
      );

      if (result[0].count === 0) {
        // 从环境变量获取默认密码，如果未设置则生成随机密码
        const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        await this.dataSource.query(
          'INSERT INTO admins (id, username, password, name, role, status, force_change_password, created_at, updated_at) VALUES (UUID(), ?, ?, ?, 1, 1, 1, NOW(), NOW())',
          ['admin', hashedPassword, '超级管理员']
        );
        console.log('✅ 默认管理员账号已创建');
        console.log('   用户名: admin');
        if (process.env.NODE_ENV === 'production') {
          // 生产环境不打印密码，提示查看环境变量
          if (process.env.ADMIN_DEFAULT_PASSWORD) {
            console.log('   密码: 请查看 ADMIN_DEFAULT_PASSWORD 环境变量');
          } else {
            console.log('   密码: 请查看服务器启动日志（仅显示一次）');
            console.log('   密码: ' + defaultPassword);
          }
        } else {
          console.log('   密码: ' + defaultPassword);
        }
        console.log('   ⚠️  首次登录将强制修改密码！');
      } else {
        console.log('ℹ️  管理员账号已存在');
      }
    } catch (error) {
      console.error('❌ 初始化管理员失败:', error);
    }
  }

  private generateRandomPassword(length: number = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async initializeSystemConfig() {
    try {
      const defaultConfigs = [
        { key: 'site_name', value: '云端牧场', type: 'basic', description: '网站名称' },
        { key: 'site_title', value: '云端牧场 - 智慧农业领养平台', type: 'basic', description: '网站标题' },
        { key: 'site_description', value: '连接自然与科技，每一份领养都是对生命的尊重与呵护', type: 'basic', description: '网站描述(SEO)' },
        { key: 'site_keywords', value: '云端牧场,智慧农业,活体领养,云养殖', type: 'basic', description: '网站关键词(SEO)' },
        { key: 'contact_phone', value: '', type: 'basic', description: '联系电话' },
        { key: 'contact_email', value: '', type: 'basic', description: '联系邮箱' },
        // 支付宝H5支付配置
        { key: 'alipay_app_id', value: '', type: 'payment', description: '支付宝App ID' },
        { key: 'alipay_private_key', value: '', type: 'payment', description: '支付宝应用私钥' },
        { key: 'alipay_public_key', value: '', type: 'payment', description: '支付宝公钥' },
        { key: 'alipay_notify_url', value: '', type: 'payment', description: '支付宝支付回调URL' },
        { key: 'alipay_return_url', value: '', type: 'payment', description: '支付宝支付返回URL' },
        // 微信H5支付配置
        { key: 'wechat_app_id', value: '', type: 'payment', description: '微信App ID' },
        { key: 'wechat_mch_id', value: '', type: 'payment', description: '微信商户号' },
        { key: 'wechat_pay_key', value: '', type: 'payment', description: '微信支付V2密钥' },
        { key: 'wechat_api_v3_key', value: '', type: 'payment', description: '微信支付V3密钥' },
        { key: 'wechat_serial_no', value: '', type: 'payment', description: '商户证书序列号' },
        { key: 'wechat_private_key', value: '', type: 'payment', description: '商户API私钥' },
        { key: 'wechat_notify_url', value: '', type: 'payment', description: '微信支付回调URL' },
        // 阿里云短信配置
        { key: 'aliyun_access_key_id', value: '', type: 'sms', description: '阿里云Access Key ID' },
        { key: 'aliyun_access_key_secret', value: '', type: 'sms', description: '阿里云Access Key Secret' },
        { key: 'aliyun_sign_name', value: '', type: 'sms', description: '短信签名' },
        { key: 'aliyun_template_code', value: '', type: 'sms', description: '短信模板Code' },
      ];

      for (const config of defaultConfigs) {
        const result = await this.dataSource.query(
          'SELECT COUNT(*) as count FROM system_configs WHERE config_key = ?',
          [config.key]
        );

        if (result[0].count === 0) {
          await this.dataSource.query(
            'INSERT INTO system_configs (id, config_key, config_value, config_type, description, is_encrypted, created_at, updated_at) VALUES (UUID(), ?, ?, ?, ?, 0, NOW(), NOW())',
            [config.key, config.value, config.type, config.description]
          );
        }
      }
      console.log('✅ 系统配置初始化完成');
    } catch (error) {
      console.error('❌ 初始化系统配置失败:', error);
    }
  }
}
