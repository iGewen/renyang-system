/**
 * 数据库初始化脚本
 * 用于生产环境初始化数据库表结构
 *
 * 使用方法：
 * 1. 确保 .env 文件配置了正确的数据库连接信息
 * 2. 创建数据库: CREATE DATABASE cloud_ranch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 * 3. 运行: npm run db:init
 */

import { createConnection, Connection } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 导入所有实体
import { User } from '../src/entities/user.entity';
import { BalanceLog } from '../src/entities/balance-log.entity';
import { LivestockType } from '../src/entities/livestock-type.entity';
import { Livestock } from '../src/entities/livestock.entity';
import { Order } from '../src/entities/order.entity';
import { Adoption } from '../src/entities/adoption.entity';
import { FeedBill } from '../src/entities/feed-bill.entity';
import { RedemptionOrder } from '../src/entities/redemption-order.entity';
import { RefundOrder } from '../src/entities/refund-order.entity';
import { PaymentRecord } from '../src/entities/payment-record.entity';
import { Notification } from '../src/entities/notification.entity';
import { SmsCode } from '../src/entities/sms-code.entity';
import { Admin } from '../src/entities/admin.entity';
import { SystemConfig } from '../src/entities/system-config.entity';
import { AuditLog } from '../src/entities/audit-log.entity';

async function initDatabase() {
  console.log('🚀 开始初始化数据库...');

  let connection: Connection | null = null;

  try {
    // 创建数据库连接
    connection = await createConnection({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'cloud_ranch',
      entities: [
        User,
        BalanceLog,
        LivestockType,
        Livestock,
        Order,
        Adoption,
        FeedBill,
        RedemptionOrder,
        RefundOrder,
        PaymentRecord,
        Notification,
        SmsCode,
        Admin,
        SystemConfig,
        AuditLog,
      ],
      synchronize: true, // 同步表结构
      logging: true,
      charset: 'utf8mb4',
    });

    console.log('✅ 数据库连接成功');

    // 创建默认超级管理员
    const adminRepository = connection.getRepository(Admin);
    const existingAdmin = await adminRepository.findOne({ where: { username: 'admin' } });

    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123456', 10);

      const admin = adminRepository.create({
        id: `A${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        username: 'admin',
        password: hashedPassword,
        name: '超级管理员',
        role: 1, // 超级管理员
        status: 1,
      });

      await adminRepository.save(admin);
      console.log('✅ 创建默认管理员账号: admin / admin123456');
    } else {
      console.log('ℹ️  管理员账号已存在');
    }

    // 创建默认活体类型
    const livestockTypeRepository = connection.getRepository(LivestockType);
    const existingTypes = await livestockTypeRepository.count();

    if (existingTypes === 0) {
      const types = [
        { id: 'LT1', name: '山羊', icon: 'goat', description: '温顺可爱的山羊', sortOrder: 1, status: 1 },
        { id: 'LT2', name: '绵羊', icon: 'sheep', description: '毛茸茸的绵羊', sortOrder: 2, status: 1 },
        { id: 'LT3', name: '黄牛', icon: 'cattle', description: '强壮的黄牛', sortOrder: 3, status: 1 },
        { id: 'LT4', name: '水牛', icon: 'buffalo', description: '勤劳的水牛', sortOrder: 4, status: 1 },
      ];

      for (const type of types) {
        await livestockTypeRepository.save(livestockTypeRepository.create(type));
      }
      console.log('✅ 创建默认活体类型');
    }

    // 创建默认系统配置
    const systemConfigRepository = connection.getRepository(SystemConfig);
    const existingConfigs = await systemConfigRepository.count();

    if (existingConfigs === 0) {
      const configs = [
        { id: 'SC1', configKey: 'late_fee_config', configValue: JSON.stringify({ startDays: 3, rate: 0.001, capRate: 0.5 }), configType: 'business', description: '滞纳金配置' },
        { id: 'SC2', configKey: 'feed_bill_config', configValue: JSON.stringify({ generateAdvanceDays: 5 }), configType: 'business', description: '饲料费账单配置' },
        { id: 'SC3', configKey: 'order_config', configValue: JSON.stringify({ expireMinutes: 15 }), configType: 'business', description: '订单配置' },
      ];

      for (const config of configs) {
        await systemConfigRepository.save(systemConfigRepository.create(config));
      }
      console.log('✅ 创建默认系统配置');
    }

    console.log('\n🎉 数据库初始化完成！');
    console.log('\n📋 初始化信息：');
    console.log('   - 数据库: ' + process.env.DB_DATABASE);
    console.log('   - 管理员账号: admin');
    console.log('   - 管理员密码: admin123456');
    console.log('\n⚠️  请在生产环境中修改默认密码！\n');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// 执行初始化
initDatabase();
