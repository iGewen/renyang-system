import { Module, MiddlewareConsumer, NestModule, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
        entities: [__dirname + '/entities/*{.ts,.js}'],
        synchronize: false, // 禁用自动同步，避免索引冲突
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

    // 安全修复 B-SEC-002：全局速率限制，防止暴力破解和DoS攻击
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1秒窗口
        limit: 3,     // 最多3次请求
      },
      {
        name: 'medium',
        ttl: 10000,   // 10秒窗口
        limit: 20,    // 最多20次请求
      },
      {
        name: 'long',
        ttl: 60000,   // 1分钟窗口
        limit: 100,   // 最多100次请求
      },
    ]),

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
    // 安全修复 B-SEC-002：全局速率限制守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppLogger,
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
    await this.initializeLivestockTypes();
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
      this.logger.error(`缺少必要的环境变量: ${missing.join(', ')}`);
      throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`);
    }

    // 检查JWT_SECRET长度
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      this.logger.warn(`JWT_SECRET 长度建议至少32位，当前长度: ${process.env.JWT_SECRET.length}`);
    }
  }

  private async initializeAdmin() {
    try {
      const result = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM admins WHERE username = ?',
        ['admin']
      );

      const count = Number(result[0].count);
      if (count === 0) {
        // 生产环境必须设置环境变量
        if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_DEFAULT_PASSWORD) {
          this.logger.error('生产环境必须设置 ADMIN_DEFAULT_PASSWORD 环境变量');
          throw new Error('生产环境未设置 ADMIN_DEFAULT_PASSWORD');
        }

        // 从环境变量获取默认密码，如果未设置则生成随机密码（仅开发环境）
        const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        // 生成32字符的UUID（不带横线）
        const crypto = require('crypto');
        const adminId = crypto.randomUUID().replaceAll('-', '');
        await this.dataSource.query(
          'INSERT INTO admins (id, username, password, name, role, status, force_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, 1, NOW(), NOW())',
          [adminId, 'admin', hashedPassword, '超级管理员']
        );
        this.logger.log('默认管理员账号已创建 (用户名: admin)');
        // 安全修复：不在日志中打印密码
        if (process.env.ADMIN_DEFAULT_PASSWORD) {
          this.logger.log('密码: 请查看 ADMIN_DEFAULT_PASSWORD 环境变量');
        } else {
          // 仅开发环境显示随机密码
          this.logger.warn(`随机密码（仅显示一次）: ${defaultPassword}`);
        }
        this.logger.warn('首次登录将强制修改密码');
      } else {
        this.logger.log('管理员账号已存在');
      }
    } catch (error) {
      this.logger.error('初始化管理员失败', error);
      throw error;
    }
  }

  private generateRandomPassword(length: number = 12): string {
    // 使用密码学安全的随机数生成器
    const crypto = require('crypto');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(crypto.randomInt(0, chars.length));
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
        { key: 'contact_wechat', value: '', type: 'basic', description: '客服微信' },
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
        // 支付开关配置
        { key: 'payment_alipay_enabled', value: 'true', type: 'payment', description: '支付宝支付开关' },
        { key: 'payment_wechat_enabled', value: 'true', type: 'payment', description: '微信支付开关' },
        // 微信公众号模板消息配置
        { key: 'wechat_template_adoption_success', value: '', type: 'wechat_template', description: '领养成功通知模板ID' },
        { key: 'wechat_template_feed_bill', value: '', type: 'wechat_template', description: '饲料费账单模板ID' },
        { key: 'wechat_template_feed_bill_overdue', value: '', type: 'wechat_template', description: '饲料费逾期模板ID' },
        { key: 'wechat_template_redemption_audit', value: '', type: 'wechat_template', description: '买断审核模板ID' },
        { key: 'wechat_template_redemption_success', value: '', type: 'wechat_template', description: '买断成功模板ID' },
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
      this.logger.log('系统配置初始化完成');
    } catch (error) {
      this.logger.error('初始化系统配置失败', error);
    }
  }

  private async initializeLivestockTypes() {
    try {
      const result = await this.dataSource.query('SELECT COUNT(*) as count FROM livestock_types');
      const count = Number(result[0].count);

      if (count === 0) {
        const defaultTypes = [
          { id: 'LT001', name: '山羊', icon: 'goat', description: '温顺可爱的山羊', sortOrder: 1 },
          { id: 'LT002', name: '绵羊', icon: 'sheep', description: '毛茸茸的绵羊', sortOrder: 2 },
          { id: 'LT003', name: '黄牛', icon: 'cattle', description: '强壮的黄牛', sortOrder: 3 },
          { id: 'LT004', name: '水牛', icon: 'buffalo', description: '勤劳的水牛', sortOrder: 4 },
        ];

        for (const type of defaultTypes) {
          await this.dataSource.query(
            'INSERT INTO livestock_types (id, name, icon, description, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
            [type.id, type.name, type.icon, type.description, type.sortOrder]
          );
        }
        this.logger.log('默认活体类型已初始化');
      }
    } catch (error) {
      this.logger.error('初始化活体类型失败', error);
    }
  }
}
