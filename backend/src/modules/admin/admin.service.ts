import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  Admin,
  User,
  Order,
  Adoption,
  FeedBill,
  FeedBillStatus,
  RedemptionOrder,
  RefundOrder,
  AuditLog,
  OrderStatus,
  AdoptionStatus,
} from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { JwtService } from '@nestjs/jwt';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private readonly feedBillRepository: Repository<FeedBill>,
    @InjectRepository(RedemptionOrder)
    private readonly redemptionOrderRepository: Repository<RedemptionOrder>,
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  // =============== 管理员认证相关 ===============

  // 登录失败限制常量
  private readonly ADMIN_LOGIN_FAIL_MAX_ATTEMPTS = 5;
  private readonly ADMIN_LOGIN_FAIL_LOCK_DURATION = 900; // 15分钟

  /**
   * 管理员登录
   * 安全修复：添加暴力破解防护，记录 userAgent
   */
  async login(username: string, password: string, ip: string, userAgent?: string) {
    // 检查是否被锁定
    const lockKey = `admin:login:lock:${username}`;
    const lockData = await this.redisService.get(lockKey);
    if (lockData) {
      const { lockUntil } = JSON.parse(lockData);
      if (Date.now() < lockUntil) {
        const remainSeconds = Math.ceil((lockUntil - Date.now()) / 1000);
        throw new UnauthorizedException(`登录失败次数过多，账号已锁定 ${Math.ceil(remainSeconds / 60)} 分钟`);
      }
    }

    const admin = await this.adminRepository
      .createQueryBuilder('admin')
      .where('admin.username = :username', { username })
      .addSelect('admin.password')
      .getOne();

    if (!admin) {
      // 记录失败次数（使用 IP + username 组合）
      await this.recordLoginFailure(username, ip);
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      // 记录失败次数
      await this.recordLoginFailure(username, ip);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功，清除失败记录
    const failKey = `admin:login:fail:${username}`;
    await this.redisService.del(failKey);

    // 更新最后登录信息
    await this.adminRepository.update(admin.id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    // 生成token - 管理员token有效期2小时
    const token = this.jwtService.sign({
      sub: admin.id,
      username: admin.username,
      type: 'admin',
      role: admin.role,
    }, {
      expiresIn: '2h',
    });

    // 记录登录日志
    await this.createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      module: 'auth',
      action: 'login',
      remark: '管理员登录',
      ip,
      userAgent,
    });

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        avatar: admin.avatar,
        forceChangePassword: admin.forceChangePassword === 1,
      },
    };
  }

  /**
   * 记录登录失败（暴力破解防护）
   */
  private async recordLoginFailure(username: string, _ip: string): Promise<void> {
    const failKey = `admin:login:fail:${username}`;
    const failCount = Number.parseInt(await this.redisService.get(failKey) || '0', 10) + 1;
    await this.redisService.set(failKey, failCount.toString(), this.ADMIN_LOGIN_FAIL_LOCK_DURATION);

    if (failCount >= this.ADMIN_LOGIN_FAIL_MAX_ATTEMPTS) {
      // 锁定账号
      const lockUntil = Date.now() + this.ADMIN_LOGIN_FAIL_LOCK_DURATION * 1000;
      const lockKey = `admin:login:lock:${username}`;
      await this.redisService.set(lockKey, JSON.stringify({ lockUntil, attempts: failCount }), this.ADMIN_LOGIN_FAIL_LOCK_DURATION);
      await this.redisService.del(failKey);
      throw new UnauthorizedException(`登录失败次数过多，账号已锁定 15 分钟`);
    }

    throw new UnauthorizedException(`用户名或密码错误，还剩 ${this.ADMIN_LOGIN_FAIL_MAX_ATTEMPTS - failCount} 次机会`);
  }

  /**
   * 获取管理员信息
   */
  async getAdminInfo(adminId: string) {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      select: ['id', 'username', 'name', 'phone', 'avatar', 'role', 'status', 'createdAt'],
    });

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    return admin;
  }

  /**
   * 修改管理员密码
   */
  async changePassword(adminId: string, oldPassword: string, newPassword: string, ip?: string, userAgent?: string) {
    const admin = await this.adminRepository
      .createQueryBuilder('admin')
      .where('admin.id = :id', { id: adminId })
      .addSelect('admin.password')
      .getOne();

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    // 安全修复：验证新密码强度（与auth.dto.ts保持一致）
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{8,128}$/;
    if (!passwordPattern.test(newPassword)) {
      throw new BadRequestException('密码必须包含大小写字母和数字，长度8-128位，不能包含空格');
    }

    // 安全修复：新密码不能与旧密码相同
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.adminRepository.update(adminId, {
      password: hashedPassword,
      forceChangePassword: 0, // 密码修改后清除强制修改标志
    });

    // 记录审计日志
    await this.createAuditLog({
      adminId,
      adminName: admin.username,
      module: 'auth',
      action: 'change_password',
      remark: '修改密码',
      ip,
      userAgent,
    });

    return { success: true };
  }

  /**
   * 验证管理员密码（用于敏感操作确认）
   */
  async verifyPassword(adminId: string, password: string) {
    const admin = await this.adminRepository
      .createQueryBuilder('admin')
      .where('admin.id = :id', { id: adminId })
      .addSelect('admin.password')
      .getOne();

    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    return { success: true };
  }

  // =============== 仪表盘 ===============

  /**
   * 获取仪表盘统计数据
   */
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 本月第一天
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    // 本年第一天
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const [
      totalUsers,
      todayUsers,
      totalOrders,
      todayOrders,
      totalAdoptions,
      activeAdoptions,
      pendingFeedBills,
      pendingRedemptions,
      pendingRefunds,
      todayRevenue,
      monthRevenue,
      yearRevenue,
      pendingOrders,
      exceptionAdoptions,
      paidOrders,
      adoptionByType,
    ] = await Promise.all([
      // 总用户数
      this.userRepository.count(),
      // 今日新增用户
      this.userRepository.count({
        where: { createdAt: Between(today, new Date()) },
      }),
      // 总订单数
      this.orderRepository.count(),
      // 今日订单数
      this.orderRepository.count({
        where: { createdAt: Between(today, new Date()) },
      }),
      // 总领养数
      this.adoptionRepository.count(),
      // 活跃领养数
      this.adoptionRepository.count({
        where: { status: In([AdoptionStatus.ACTIVE, AdoptionStatus.FEED_OVERDUE]) },
      }),
      // 待支付饲料费账单
      this.feedBillRepository.count({
        where: { status: In([FeedBillStatus.PENDING, FeedBillStatus.OVERDUE]) },
      }),
      // 待审核买断申请
      this.redemptionOrderRepository.count({
        where: { status: 1 }, // PENDING_AUDIT
      }),
      // 待审核退款申请
      this.refundOrderRepository.count({
        where: { status: 1 }, // PENDING_AUDIT
      }),
      // 今日收入
      this.orderRepository
        .createQueryBuilder('order')
        .where('order.status = :status', { status: OrderStatus.PAID })
        .andWhere('order.paidAt BETWEEN :start AND :end', {
          start: today,
          end: new Date(),
        })
        .select('SUM(order.paidAmount)', 'total')
        .getRawOne(),
      // 本月收入
      this.orderRepository
        .createQueryBuilder('order')
        .where('order.status = :status', { status: OrderStatus.PAID })
        .andWhere('order.paidAt BETWEEN :start AND :end', {
          start: monthStart,
          end: new Date(),
        })
        .select('SUM(order.paidAmount)', 'total')
        .getRawOne(),
      // 本年收入
      this.orderRepository
        .createQueryBuilder('order')
        .where('order.status = :status', { status: OrderStatus.PAID })
        .andWhere('order.paidAt BETWEEN :start AND :end', {
          start: yearStart,
          end: new Date(),
        })
        .select('SUM(order.paidAmount)', 'total')
        .getRawOne(),
      // 待支付订单
      this.orderRepository.count({
        where: { status: OrderStatus.PENDING_PAYMENT },
      }),
      // 异常领养（逾期或异常状态）
      this.adoptionRepository.count({
        where: { status: In([AdoptionStatus.FEED_OVERDUE, AdoptionStatus.EXCEPTION]) },
      }),
      // 已支付订单数
      this.orderRepository.count({
        where: { status: OrderStatus.PAID },
      }),
      // 按活体类型统计领养数
      this.adoptionRepository
        .createQueryBuilder('adoption')
        .leftJoin('adoption.livestock', 'livestock')
        .leftJoin('livestock.type', 'type')
        .select('type.id', 'typeId')
        .addSelect('type.name', 'typeName')
        .addSelect('COUNT(*)', 'count')
        .where('adoption.status IN (:...statuses)', {
          statuses: [AdoptionStatus.ACTIVE, AdoptionStatus.FEED_OVERDUE, AdoptionStatus.REDEEMABLE, AdoptionStatus.REDEMPTION_PENDING],
        })
        .groupBy('type.id')
        .addGroupBy('type.name')
        .getRawMany(),
    ]);

    return {
      totalUsers,
      todayUsers,
      totalOrders,
      todayOrders,
      totalAdoptions,
      activeAdoptions,
      pendingFeedBills,
      pendingRedemptions,
      pendingRefunds,
      todayRevenue: Number(todayRevenue?.total || 0),
      revenueToday: Number(todayRevenue?.total || 0),
      revenueMonth: Number(monthRevenue?.total || 0),
      revenueYear: Number(yearRevenue?.total || 0),
      pendingOrders,
      exceptionAdoptions,
      activeUsers: activeAdoptions,
      orderPaid: paidOrders,
      adoptionByType: adoptionByType.map(item => ({
        typeId: item.typeId,
        typeName: item.typeName || '未知类型',
        count: Number(item.count),
      })),
    };
  }

  // =============== 审计日志（供子服务调用） ===============

  /**
   * 创建审计日志
   * 公开方法，供子服务调用
   */
  async createAuditLog(params: {
    adminId: string;
    adminName: string;
    module: string;
    action: string;
    targetType?: string;
    targetId?: string;
    beforeData?: any;
    afterData?: any;
    isSensitive?: number;
    remark?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const log = this.auditLogRepository.create({
      id: IdUtil.generate('AUD'),
      ...params,
    });
    return this.auditLogRepository.save(log);
  }
}
