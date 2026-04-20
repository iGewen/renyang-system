import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  Admin,
  User,
  Order,
  Livestock,
  LivestockType,
  Adoption,
  FeedBill,
  FeedBillStatus,
  RedemptionOrder,
  RefundOrder,
  Notification,
  SystemConfig,
  AuditLog,
  OrderStatus,
  AdoptionStatus,
} from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { JwtService } from '@nestjs/jwt';
import { IdUtil } from '@/common/utils/id.util';
import { NotificationService } from '../notification/notification.service';
import { CryptoUtil } from '@/common/utils/crypto.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Livestock)
    private readonly livestockRepository: Repository<Livestock>,
    @InjectRepository(LivestockType)
    private readonly livestockTypeRepository: Repository<LivestockType>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private readonly feedBillRepository: Repository<FeedBill>,
    @InjectRepository(RedemptionOrder)
    private readonly redemptionOrderRepository: Repository<RedemptionOrder>,
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
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

    // 安全修复：验证新密码强度
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
    if (!passwordPattern.test(newPassword)) {
      throw new BadRequestException('密码必须包含大小写字母和数字，长度8-20位，可包含特殊字符@$!%*?&');
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

  // =============== 用户管理 ===============

  /**
   * 获取用户列表
   */
  async getUserList(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    status?: number;
  }) {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (params.keyword) {
      queryBuilder.andWhere(
        '(user.phone LIKE :keyword OR user.nickname LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    if (params.status !== undefined) {
      queryBuilder.andWhere('user.status = :status', { status: params.status });
    }

    queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 获取用户的领养数量
    const adoptionCount = await this.adoptionRepository.count({
      where: { userId },
    });

    // 获取用户的订单数量
    const orderCount = await this.orderRepository.count({
      where: { userId },
    });

    return {
      ...user,
      adoptionCount,
      orderCount,
    };
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: string, page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.adoption', 'adoption')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取用户余额明细
   */
  async getUserBalanceLogs(userId: string, page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.dataSource.getRepository('BalanceLog')
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取用户支付记录
   */
  async getUserPayments(userId: string, page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.dataSource.getRepository('PaymentRecord')
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(userId: string, status: number, adminId: string, adminName: string, ip?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.userRepository.update(userId, { status });

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'user',
      action: 'update_status',
      targetType: 'user',
      targetId: userId,
      beforeData: { status: user.status },
      afterData: { status },
      remark: `更新用户状态为: ${this.getUserStatusText(status)}`,
      ip,
      userAgent,
    });

    return { success: true };
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: string, data: { nickname?: string; phone?: string }, adminId: string, adminName: string, ip?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果修改手机号，检查是否已存在
    if (data.phone && data.phone !== user.phone) {
      const existing = await this.userRepository.findOne({ where: { phone: data.phone } });
      if (existing) {
        throw new BadRequestException('该手机号已被使用');
      }
    }

    const beforeData = { nickname: user.nickname, phone: user.phone };
    await this.userRepository.update(userId, data);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'user',
      action: 'update',
      targetType: 'user',
      targetId: userId,
      beforeData,
      afterData: data,
      remark: '更新用户信息',
      ip,
      userAgent,
    });

    return { success: true };
  }

  /**
   * 调整用户余额
   * 安全修复：使用原子 SQL 更新避免竞态条件
   */
  async adjustUserBalance(userId: string, amount: number, reason: string, adminId: string, adminName: string, ip?: string, userAgent?: string) {
    // 先检查用户是否存在
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const changeAmount = Number(amount);

    // 使用事务和原子更新避免竞态条件
    const result = await this.dataSource.transaction(async (manager) => {
      // 使用悲观锁读取用户
      const userWithLock = await manager.findOne('User' as any, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      }) as any;

      if (!userWithLock) {
        throw new NotFoundException('用户不存在');
      }

      const beforeBalance = Number(userWithLock.balance) || 0;
      const afterBalance = beforeBalance + changeAmount;

      if (afterBalance < 0) {
        throw new BadRequestException('余额不足');
      }

      // 保留两位小数
      const finalBalance = Math.round(afterBalance * 100) / 100;

      // 更新余额
      userWithLock.balance = finalBalance;
      await manager.save(userWithLock);

      // 记录余额变动日志
      const balanceLog = manager.create('BalanceLog' as any, {
        id: IdUtil.generate('BL'),
        userId,
        type: 4, // 调整
        amount: Math.abs(changeAmount),
        balanceBefore: beforeBalance,
        balanceAfter: finalBalance,
        relatedType: 'admin_adjust',
        remark: `管理员调整: ${reason}`,
      });
      await manager.save(balanceLog);

      return { beforeBalance, finalBalance };
    });

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'user',
      action: 'adjust',
      targetType: 'user',
      targetId: userId,
      beforeData: { balance: result.beforeBalance },
      afterData: { balance: result.finalBalance, amount, reason },
      remark: `调整用户余额: ${changeAmount >= 0 ? '+' : ''}${changeAmount}元, 原因: ${reason}`,
      ip,
      userAgent,
    });

    return { success: true, balance: result.finalBalance };
  }

  // =============== 活体类型管理 ===============

  /**
   * 获取活体类型列表
   */
  async getLivestockTypeList() {
    return this.livestockTypeRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * 创建活体类型
   */
  async createLivestockType(data: Partial<LivestockType>, adminId: string, adminName: string, ip?: string) {
    const type = this.livestockTypeRepository.create({
      id: IdUtil.generate('LT'),
      ...data,
    });

    await this.livestockTypeRepository.save(type);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'create',
      targetType: 'livestock_type',
      targetId: type.id,
      afterData: type,
      remark: '创建活体类型',
      ip,
    });

    return type;
  }

  /**
   * 更新活体类型
   */
  async updateLivestockType(id: string, data: Partial<LivestockType>, adminId: string, adminName: string, ip?: string) {
    const type = await this.livestockTypeRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException('活体类型不存在');
    }

    const beforeData = { ...type };
    Object.assign(type, data);
    await this.livestockTypeRepository.save(type);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'update',
      targetType: 'livestock_type',
      targetId: id,
      beforeData,
      afterData: type,
      remark: '更新活体类型',
      ip,
    });

    return type;
  }

  /**
   * 删除活体类型
   */
  async deleteLivestockType(id: string, adminId: string, adminName: string, ip?: string) {
    const type = await this.livestockTypeRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException('活体类型不存在');
    }

    // 检查是否有关联的活体
    const livestockCount = await this.livestockRepository.count({
      where: { typeId: id },
    });

    if (livestockCount > 0) {
      throw new BadRequestException('该类型下有活体，无法删除');
    }

    await this.livestockTypeRepository.remove(type);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock_type',
      action: 'delete',
      targetType: 'livestock_type',
      targetId: id,
      beforeData: type,
      remark: '删除活体类型',
      ip,
    });

    return { success: true };
  }

  // =============== 活体管理 ===============

  /**
   * 获取活体列表
   */
  async getLivestockList(params: {
    page: number;
    pageSize: number;
    typeId?: string;
    status?: number;
    keyword?: string;
  }) {
    const queryBuilder = this.livestockRepository.createQueryBuilder('livestock')
      .leftJoinAndSelect('livestock.type', 'type');

    if (params.typeId) {
      queryBuilder.andWhere('livestock.typeId = :typeId', { typeId: params.typeId });
    }

    if (params.status !== undefined) {
      queryBuilder.andWhere('livestock.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere('livestock.name LIKE :keyword', { keyword: `%${params.keyword}%` });
    }

    queryBuilder
      .orderBy('livestock.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 创建活体
   */
  async createLivestock(data: Partial<Livestock>, adminId: string, adminName: string, ip?: string) {
    const livestock = this.livestockRepository.create({
      id: IdUtil.generate('L'),
      livestockNo: IdUtil.generateLivestockNo(), // 活体编号 = 领养编号
      ...data,
    });

    await this.livestockRepository.save(livestock);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'create',
      targetType: 'livestock',
      targetId: livestock.id,
      afterData: livestock,
      remark: '创建活体',
      ip,
    });

    return livestock;
  }

  /**
   * 更新活体
   */
  async updateLivestock(id: string, data: Partial<Livestock>, adminId: string, adminName: string, ip?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    const beforeData = { ...livestock };
    Object.assign(livestock, data);
    await this.livestockRepository.save(livestock);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'update',
      targetType: 'livestock',
      targetId: id,
      beforeData,
      afterData: livestock,
      remark: '更新活体',
      ip,
    });

    return livestock;
  }

  /**
   * 更新活体状态
   */
  async updateLivestockStatus(id: string, status: number, adminId: string, adminName: string, ip?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    const beforeData = { status: livestock.status };
    await this.livestockRepository.update(id, { status });

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'update_status',
      targetType: 'livestock',
      targetId: id,
      beforeData,
      afterData: { status },
      remark: `更新活体状态为: ${status}`,
      ip,
    });

    return { success: true };
  }

  /**
   * 删除活体
   * 安全修复：删除前检查是否有活跃认养
   */
  async deleteLivestock(id: string, adminId: string, adminName: string, ip?: string, userAgent?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
    }

    // 安全修复：检查是否有进行中的认养
    const activeAdoptionCount = await this.adoptionRepository.count({
      where: {
        livestockId: id,
        status: In([AdoptionStatus.ACTIVE, AdoptionStatus.FEED_OVERDUE, AdoptionStatus.REDEEMABLE, AdoptionStatus.REDEMPTION_PENDING]),
      },
    });

    if (activeAdoptionCount > 0) {
      throw new BadRequestException(`该活体有 ${activeAdoptionCount} 个进行中的认养，无法删除`);
    }

    // 软删除
    await this.livestockRepository.softDelete(id);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'livestock',
      action: 'delete',
      targetType: 'livestock',
      targetId: id,
      beforeData: livestock,
      remark: '删除活体',
      ip,
      userAgent,
    });

    return { success: true };
  }

  // =============== 订单管理 ===============

  /**
   * 获取订单列表
   * 安全修复：移除对不存在字段 orderType 的查询
   */
  async getOrderList(params: {
    page: number;
    pageSize: number;
    status?: OrderStatus;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.adoption', 'adoption');

    if (params.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', { status: params.status });
    }

    // 安全修复：移除了 orderType 查询，因为 Order 实体没有 orderType 字段
    // 如需区分订单类型，可通过 adoption 关联是否存在来判断

    if (params.keyword) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :keyword OR user.phone LIKE :keyword OR user.nickname LIKE :keyword OR adoption.adoptionNo LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    if (params.startDate && params.endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    queryBuilder
      .orderBy('order.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'livestock', 'adoption'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return order;
  }

  /**
   * 删除订单
   * 安全修复：改为软删除，保留数据用于审计和恢复
   */
  async deleteOrder(orderId: string, adminId: string, adminName: string, ip: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['adoption'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 只有已取消或已退款的订单可以删除
    if (order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REFUNDED) {
      throw new BadRequestException('只能删除已取消或已退款的订单');
    }

    // 软删除关联的领养记录（如果存在）
    if (order.adoption) {
      await this.adoptionRepository.softDelete(order.adoption.id);
    }

    // 软删除订单（保留数据用于审计和恢复）
    await this.orderRepository.softDelete(orderId);

    // 记录审计日志
    const auditLog = this.auditLogRepository.create({
      adminId,
      adminName,
      module: 'order',
      action: 'delete',
      targetType: 'order',
      targetId: orderId,
      beforeData: {
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: order.totalAmount,
      },
      remark: `软删除订单: ${order.orderNo}`,
      ip,
    });
    await this.auditLogRepository.save(auditLog);

    return { success: true, message: '订单已删除' };
  }

  // =============== 领养管理 ===============

  /**
   * 获取领养列表
   */
  async getAdoptionList(params: {
    page: number;
    pageSize: number;
    status?: AdoptionStatus;
    keyword?: string;
  }) {
    const queryBuilder = this.adoptionRepository.createQueryBuilder('adoption')
      .leftJoinAndSelect('adoption.user', 'user')
      .leftJoinAndSelect('adoption.livestock', 'livestock');

    if (params.status !== undefined) {
      queryBuilder.andWhere('adoption.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere(
        '(adoption.adoptionNo LIKE :keyword OR user.phone LIKE :keyword OR user.nickname LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    queryBuilder
      .orderBy('adoption.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取领养详情
   */
  async getAdoptionDetail(adoptionId: string) {
    const adoption = await this.adoptionRepository.findOne({
      where: { id: adoptionId },
      relations: ['user', 'livestock', 'feedBills'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    return adoption;
  }

  // =============== 饲料费管理 ===============

  /**
   * 获取饲料费账单列表
   */
  async getFeedBillList(params: {
    page: number;
    pageSize: number;
    status?: FeedBillStatus;
    keyword?: string;
  }) {
    const queryBuilder = this.feedBillRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.adoption', 'adoption')
      .leftJoinAndSelect('bill.livestock', 'livestock')
      .leftJoinAndSelect('adoption.user', 'user');

    if (params.status !== undefined) {
      queryBuilder.andWhere('bill.status = :status', { status: params.status });
    }

    if (params.keyword) {
      queryBuilder.andWhere(
        '(bill.billNo LIKE :keyword OR user.phone LIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    queryBuilder
      .orderBy('bill.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  // =============== 系统配置管理 ===============

  /**
   * 获取系统配置
   */
  async getSystemConfig(configType?: string) {
    const where: any = {};
    if (configType) {
      where.configType = configType;
    }

    const configs = await this.systemConfigRepository.find({ where });

    // 返回数组格式，每个配置项包含完整信息
    return configs.map(config => ({
      id: config.id,
      configKey: config.configKey,
      configValue: config.isEncrypted ? this.decrypt(config.configValue) : config.configValue,
      configType: config.configType,
      description: config.description,
      isEncrypted: config.isEncrypted === 1,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  // 安全修复：系统配置键白名单
  private readonly SYSTEM_CONFIG_ALLOWED_KEYS = [
    // 基础配置
    'site_name', 'site_logo', 'site_description', 'site_keywords',
    'contact_phone', 'contact_email', 'contact_address', 'contact_wechat',
    // 支付配置
    'alipay_app_id', 'alipay_private_key', 'alipay_public_key', 'alipay_notify_url',
    'wechat_app_id', 'wechat_mch_id', 'wechat_api_key', 'wechat_notify_url',
    // 短信配置
    'aliyun_access_key_id', 'aliyun_access_key_secret', 'aliyun_sign_name', 'aliyun_template_code',
    'sms_enabled', 'sms_daily_limit',
    // 功能配置
    'order_expire_minutes', 'feed_fee_rate', 'late_fee_rate', 'redemption_fee_rate',
    'max_adoptions_per_user', 'balance_min_recharge', 'balance_max_balance',
    // 其他配置
    'user_agreement', 'privacy_policy', 'about_us', 'faq',
  ];

  /**
   * 更新系统配置
   * 安全修复：添加配置键白名单验证，防止任意键创建
   */
  async updateSystemConfig(configKey: string, configValue: any, adminId: string, adminName: string, _ip?: string) {
    // 安全修复：验证配置键是否在白名单中
    if (!this.SYSTEM_CONFIG_ALLOWED_KEYS.includes(configKey)) {
      throw new BadRequestException(`不支持的配置项: ${configKey}。请联系开发人员添加新的配置键。`);
    }

    let config = await this.systemConfigRepository.findOne({
      where: { configKey },
    });

    const valueStr = typeof configValue === 'string'
      ? configValue
      : JSON.stringify(configValue);

    // 根据配置键名自动判断类型
    const getConfigType = (key: string): string => {
      if (key.startsWith('site_') || key.startsWith('contact_')) return 'basic';
      if (key.startsWith('alipay_') || key.startsWith('wechat_')) return 'payment';
      if (key.startsWith('aliyun_') || key.startsWith('sms_')) return 'sms';
      return 'other';
    };

    const configType = getConfigType(configKey);

    if (config) {
      const beforeData = config.configValue;
      config.configValue = valueStr;
      config.configType = configType; // 更新类型
      await this.systemConfigRepository.save(config);

      await this.createAuditLog({
        adminId,
        adminName,
        module: 'system_config',
        action: 'update',
        targetType: 'system_config',
        targetId: config.id,
        beforeData: { value: beforeData },
        afterData: { value: valueStr },
        remark: `更新配置: ${configKey}`,
        isSensitive: 1,
      });
    } else {
      config = this.systemConfigRepository.create({
        id: IdUtil.generate('SC'),
        configKey,
        configValue: valueStr,
        configType,
      });
      await this.systemConfigRepository.save(config);

      await this.createAuditLog({
        adminId,
        adminName,
        module: 'system_config',
        action: 'create',
        targetType: 'system_config',
        targetId: config.id,
        afterData: { key: configKey, value: valueStr },
        remark: `创建配置: ${configKey}`,
      });
    }

    // 更新缓存
    await this.redisService.set(`system:config:${configKey}`, valueStr);

    return { success: true };
  }

  // =============== 统计数据 ===============

  /**
   * 获取仪表盘统计
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

  // =============== 管理员管理（超级管理员） ===============

  /**
   * 获取管理员列表
   */
  async getAdminList(page: number = 1, pageSize: number = 20) {
    const [list, total] = await this.adminRepository.findAndCount({
      select: ['id', 'username', 'name', 'phone', 'avatar', 'role', 'status', 'lastLoginAt', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 创建管理员
   */
  async createAdmin(data: { username: string; password: string; name?: string; phone?: string; role: number }, adminId: string, adminName: string, ip?: string) {
    // 检查用户名是否已存在
    const existing = await this.adminRepository.findOne({
      where: { username: data.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const admin = this.adminRepository.create({
      id: IdUtil.generate('A'),
      ...data,
      password: hashedPassword,
    });

    await this.adminRepository.save(admin);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'admin',
      action: 'create',
      targetType: 'admin',
      targetId: admin.id,
      afterData: { username: admin.username, name: admin.name, role: admin.role },
      remark: '创建管理员',
      isSensitive: 1,
      ip,
    });

    return {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    };
  }

  /**
   * 更新管理员状态
   */
  async updateAdminStatus(targetAdminId: string, status: number, adminId: string, adminName: string, ip?: string) {
    const admin = await this.adminRepository.findOne({ where: { id: targetAdminId } });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }

    // 不能禁用自己
    if (targetAdminId === adminId) {
      throw new BadRequestException('不能禁用自己的账号');
    }

    await this.adminRepository.update(targetAdminId, { status });

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'admin',
      action: 'update_status',
      targetType: 'admin',
      targetId: targetAdminId,
      beforeData: { status: admin.status },
      afterData: { status },
      remark: `更新管理员状态为: ${status === 1 ? '启用' : '禁用'}`,
      ip,
    });

    return { success: true };
  }

  // =============== 审计日志 ===============

  /**
   * 获取审计日志
   */
  async getAuditLogs(params: {
    page: number;
    pageSize: number;
    module?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (params.module) {
      queryBuilder.andWhere('log.module = :module', { module: params.module });
    }

    if (params.adminId) {
      queryBuilder.andWhere('log.adminId = :adminId', { adminId: params.adminId });
    }

    if (params.startDate && params.endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  // =============== 辅助方法 ===============

  /**
   * 创建审计日志
   */
  private async createAuditLog(params: {
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
    const log = this.auditLogRepository.create(params);
    return this.auditLogRepository.save(log);
  }

  /**
   * AES加密敏感配置
   * 安全修复：使用独立的 ENCRYPTION_KEY，与 JWT_SECRET 分离
   */
  private encrypt(text: string): string {
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY 未配置或长度不足32位，请检查环境变量');
    }
    return CryptoUtil.aesEncrypt(text, key);
  }

  /**
   * AES解密敏感配置
   * 安全修复：使用独立的 ENCRYPTION_KEY，与 JWT_SECRET 分离
   */
  private decrypt(text: string): string {
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key || key.length < 32) {
      throw new Error('ENCRYPTION_KEY 未配置或长度不足32位，请检查环境变量');
    }
    try {
      return CryptoUtil.aesDecrypt(text, key);
    } catch {
      // 如果解密失败，可能是旧的Base64编码数据，尝试兼容
      return Buffer.from(text, 'base64').toString();
    }
  }

  /**
   * 发送系统公告
   */
  async sendSystemAnnouncement(title: string, content: string, adminId: string, adminName: string, ip?: string) {
    const notification = this.notificationRepository.create({
      id: IdUtil.generate('N'), // 安全修复：使用 IdUtil 替代 Date.now()
      title,
      content,
      type: 'system',
    });

    await this.notificationRepository.save(notification);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'notification',
      action: 'send_announcement',
      targetType: 'notification',
      targetId: notification.id,
      afterData: { title, content },
      remark: '发送系统公告',
      ip,
    });

    return notification;
  }

  // =============== 买断管理 ===============

  /**
   * 获取买断订单列表
   */
  async getRedemptionList(params: {
    page: number;
    pageSize: number;
    status?: number;
  }) {
    const queryBuilder = this.redemptionOrderRepository.createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.user', 'user')
      .leftJoinAndSelect('redemption.livestock', 'livestock')
      .leftJoinAndSelect('redemption.adoption', 'adoption');

    if (params.status !== undefined) {
      queryBuilder.andWhere('redemption.status = :status', { status: params.status });
    }

    queryBuilder
      .orderBy('redemption.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取买断订单详情
   */
  async getRedemptionDetail(id: string) {
    const redemption = await this.redemptionOrderRepository.findOne({
      where: { id },
      relations: ['user', 'livestock', 'adoption'],
    });

    if (!redemption) {
      throw new NotFoundException('买断订单不存在');
    }

    return redemption;
  }

  /**
   * 审核买断申请
   */
  async auditRedemption(
    id: string,
    approved: boolean,
    adjustedAmount: number | undefined,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    const redemption = await this.redemptionOrderRepository.findOne({
      where: { id },
      relations: ['adoption'],
    });
    if (!redemption) {
      throw new NotFoundException('买断订单不存在');
    }

    if (redemption.status !== 1) {
      throw new BadRequestException('该买断申请不在待审核状态');
    }

    const beforeData = { status: redemption.status };
    redemption.status = approved ? 2 : 3; // 2: 审核通过, 3: 审核拒绝

    if (approved && adjustedAmount !== undefined) {
      redemption.adjustedAmount = adjustedAmount;
      redemption.finalAmount = adjustedAmount;
    }

    if (remark) {
      redemption.auditRemark = remark;
    }

    redemption.auditAdminId = adminId;
    redemption.auditAt = new Date();

    await this.redemptionOrderRepository.save(redemption);

    // 如果审核拒绝，恢复领养状态
    if (!approved && redemption.adoption) {
      redemption.adoption.status = 1; // 恢复为领养中
      await this.adoptionRepository.save(redemption.adoption);
    }

    // 发送站内信通知用户
    try {
      // 构建通知内容
      const amountStr = adjustedAmount === undefined ? `金额：¥${redemption.finalAmount}` : `调整后金额：¥${adjustedAmount}`;
      const approvedContent = `您的买断申请（编号：${redemption.redemptionNo}）已通过审核，请尽快完成支付。${amountStr}`;
      const remarkText = remark ? `原因：${remark}` : '';
      const rejectedContent = `您的买断申请（编号：${redemption.redemptionNo}）未通过审核。${remarkText}`;

      await this.notificationService.createNotification({
        userId: redemption.userId,
        title: approved ? '买断申请已通过' : '买断申请已拒绝',
        content: approved ? approvedContent : rejectedContent,
        type: 'redemption',
        relatedType: 'redemption',
        relatedId: redemption.id,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'redemption',
      action: approved ? 'approve' : 'reject',
      targetType: 'redemption',
      targetId: id,
      beforeData,
      afterData: { status: redemption.status, adjustedAmount, remark },
      remark: approved ? '审核通过买断申请' : '审核拒绝买断申请',
      ip,
    });

    return redemption;
  }

  // =============== 退款管理 ===============

  /**
   * 获取退款订单列表
   */
  async getRefundList(params: {
    page: number;
    pageSize: number;
    status?: number;
  }) {
    const queryBuilder = this.refundOrderRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user');

    if (params.status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status: params.status });
    }

    queryBuilder
      .orderBy('refund.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 获取退款订单详情
   */
  async getRefundDetail(id: string) {
    const refund = await this.refundOrderRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款订单不存在');
    }

    return refund;
  }

  /**
   * 审核退款申请
   */
  async auditRefund(
    id: string,
    approved: boolean,
    remark: string | undefined,
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    const refund = await this.refundOrderRepository.findOne({ where: { id } });
    if (!refund) {
      throw new NotFoundException('退款订单不存在');
    }

    if (refund.status !== 1) {
      throw new BadRequestException('该退款申请不在待审核状态');
    }

    const beforeData = { status: refund.status };
    refund.status = approved ? 2 : 3; // 2: 审核通过, 3: 审核拒绝

    if (remark) {
      refund.auditRemark = remark;
    }

    refund.auditAdminId = adminId;
    refund.auditAt = new Date();

    await this.refundOrderRepository.save(refund);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'refund',
      action: approved ? 'approve' : 'reject',
      targetType: 'refund',
      targetId: id,
      beforeData,
      afterData: { status: refund.status, remark },
      remark: approved ? '审核通过退款申请' : '审核拒绝退款申请',
      ip,
    });

    return refund;
  }

  // =============== 通知管理 ===============

  /**
   * 获取通知列表
   */
  async getNotificationList(params: {
    page: number;
    pageSize: number;
    type?: string;
  }) {
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification');

    if (params.type) {
      queryBuilder.andWhere('notification.type = :type', { type: params.type });
    }

    queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  /**
   * 发送通知
   * 安全修复：使用 IdUtil 替代 Date.now() 生成 ID
   */
  async sendNotification(
    data: { userIds?: string[]; title: string; content: string; type: string },
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    let sendCount = 0;

    if (data.userIds && data.userIds.length > 0) {
      // 发送给指定用户
      for (const userId of data.userIds) {
        const notification = this.notificationRepository.create({
          id: IdUtil.generate('N'), // 安全修复：使用 IdUtil 替代 Date.now()
          userId,
          title: data.title,
          content: data.content,
          type: data.type,
        });
        await this.notificationRepository.save(notification);
        sendCount++;
      }
    } else {
      // 发送给所有用户 - 为每个用户创建独立的通知记录
      const users = await this.userRepository.find({
        where: { status: 1 }, // 只发送给正常状态的用户
        select: ['id'],
      });

      // 批量创建通知 - 安全修复：使用 IdUtil 替代 Date.now()
      const notifications = users.map(() => {
        return this.notificationRepository.create({
          id: IdUtil.generate('N'),
          userId: undefined, // 将在下面设置
          title: data.title,
          content: data.content,
          type: data.type,
        });
      });

      // 设置用户 ID
      notifications.forEach((notification, index) => {
        notification.userId = users[index].id;
      });

      // 批量保存
      await this.notificationRepository.save(notifications);
      sendCount = users.length;
    }

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'notification',
      action: 'send',
      targetType: 'notification',
      afterData: { title: data.title, content: data.content, type: data.type, sendCount },
      remark: `发送通知: ${data.title}`,
      ip,
    });

    return { success: true, sendCount };
  }

  // =============== 协议管理 ===============

  /**
   * 获取协议列表
   */
  async getAgreements() {
    const configs = await this.systemConfigRepository.find({
      where: { configType: 'agreement' },
      order: { createdAt: 'ASC' },
    });

    return configs.map(config => ({
      id: config.id,
      agreementKey: config.configKey,
      title: config.description || config.configKey,
      content: config.configValue,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * 获取单个协议
   */
  async getAgreement(key: string) {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key, configType: 'agreement' },
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      agreementKey: config.configKey,
      title: config.description || config.configKey,
      content: config.configValue,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 保存协议
   */
  async saveAgreement(data: { agreementKey: string; title: string; content: string }, adminId: string, adminName: string, ip?: string) {
    let config = await this.systemConfigRepository.findOne({
      where: { configKey: data.agreementKey },
    });

    if (config) {
      // 更新现有协议
      const beforeData = { title: config.description, content: config.configValue };
      config.configValue = data.content;
      config.description = data.title;
      await this.systemConfigRepository.save(config);

      await this.createAuditLog({
        adminId,
        adminName,
        module: 'agreement',
        action: 'update',
        targetType: 'agreement',
        targetId: config.id,
        beforeData,
        afterData: { title: data.title, content: data.content },
        remark: `更新协议: ${data.title}`,
        ip,
      });

      return { success: true, id: config.id };
    } else {
      // 创建新协议
      config = this.systemConfigRepository.create({
        id: IdUtil.generate('AG'),
        configKey: data.agreementKey,
        configValue: data.content,
        configType: 'agreement',
        description: data.title,
      });
      await this.systemConfigRepository.save(config);

      await this.createAuditLog({
        adminId,
        adminName,
        module: 'agreement',
        action: 'create',
        targetType: 'agreement',
        targetId: config.id,
        afterData: { key: data.agreementKey, title: data.title },
        remark: `创建协议: ${data.title}`,
        ip,
      });

      return { success: true, id: config.id };
    }
  }

  /**
   * 删除协议
   */
  async deleteAgreement(key: string, adminId: string, adminName: string, ip?: string) {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key, configType: 'agreement' },
    });

    if (!config) {
      throw new NotFoundException('协议不存在');
    }

    await this.systemConfigRepository.remove(config);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'agreement',
      action: 'delete',
      targetType: 'agreement',
      targetId: config.id,
      beforeData: { key, title: config.description },
      remark: `删除协议: ${config.description}`,
      ip,
    });

    return { success: true };
  }

  /**
   * 清空审计日志
   * 安全说明：仅超级管理员可操作
   */
  async clearAuditLogs(adminId: string, adminName: string, ip?: string, userAgent?: string) {
    // 记录清空操作日志（在清空前记录）
    await this.createAuditLog({
      adminId,
      adminName,
      module: 'audit_log',
      action: 'clear',
      targetType: 'audit_log',
      remark: '清空审计日志',
      isSensitive: 1,
      ip,
      userAgent,
    });

    // 清空所有日志
    await this.auditLogRepository.clear();

    return { success: true };
  }

  // =============== 数据导出 ===============

  /**
   * 导出用户数据
   */
  async exportUsers(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (params.status) {
      queryBuilder.andWhere('user.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('user.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('user.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');

    const users = await queryBuilder.getMany();

    // 转换为导出格式
    const data = users.map(user => ({
      '用户ID': user.id,
      '手机号': user.phone,
      '昵称': user.nickname || '',
      '余额': Number(user.balance).toFixed(2),
      '状态': this.getUserStatusText(user.status),
      '最后登录时间': user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '',
      '注册时间': new Date(user.createdAt).toLocaleString('zh-CN'),
    }));

    return this.generateExcelBase64(data, '用户数据');
  }

  /**
   * 导出订单数据
   */
  async exportOrders(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.livestock', 'livestock')
      .leftJoinAndSelect('order.user', 'user');

    if (params.status) {
      queryBuilder.andWhere('order.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const orders = await queryBuilder.getMany();

    const data = orders.map(order => ({
      '订单ID': order.id,
      '订单编号': order.orderNo,
      '用户手机号': order.user?.phone || '',
      '活体名称': order.livestockSnapshot?.name || order.livestock?.name || '',
      '数量': order.quantity,
      '订单金额': Number(order.totalAmount).toFixed(2),
      '实付金额': Number(order.paidAmount || 0).toFixed(2),
      '支付方式': order.paymentMethod || '',
      '状态': this.getOrderStatusText(order.status),
      '创建时间': new Date(order.createdAt).toLocaleString('zh-CN'),
      '支付时间': order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : '',
    }));

    return this.generateExcelBase64(data, '订单数据');
  }

  /**
   * 导出领养数据
   */
  async exportAdoptions(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.adoptionRepository.createQueryBuilder('adoption')
      .leftJoinAndSelect('adoption.user', 'user')
      .leftJoinAndSelect('adoption.livestock', 'livestock');

    if (params.status) {
      queryBuilder.andWhere('adoption.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('adoption.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('adoption.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('adoption.createdAt', 'DESC');

    const adoptions = await queryBuilder.getMany();

    const statusMap: Record<number, string> = {
      1: '领养中', 2: '饲料费逾期', 3: '异常', 4: '可买断',
      5: '买断审核中', 6: '已买断', 7: '已终止'
    };

    const data = adoptions.map(adoption => ({
      '领养ID': adoption.id,
      '领养编号': adoption.adoptionNo,
      '用户手机号': adoption.user?.phone || '',
      '活体名称': adoption.livestockSnapshot?.name || adoption.livestock?.name || '',
      '开始日期': new Date(adoption.startDate).toLocaleDateString('zh-CN'),
      '已缴月数': adoption.feedMonthsPaid,
      '累计饲料费': Number(adoption.totalFeedAmount || 0).toFixed(2),
      '滞纳金': Number(adoption.lateFeeAmount || 0).toFixed(2),
      '状态': statusMap[adoption.status] || '未知',
      '创建时间': new Date(adoption.createdAt).toLocaleString('zh-CN'),
    }));

    return this.generateExcelBase64(data, '领养数据');
  }

  /**
   * 导出饲料费账单数据
   */
  async exportFeedBills(params: { status?: number; startDate?: string; endDate?: string }) {
    const queryBuilder = this.feedBillRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.user', 'user')
      .leftJoinAndSelect('bill.adoption', 'adoption');

    if (params.status) {
      queryBuilder.andWhere('bill.status = :status', { status: params.status });
    }

    if (params.startDate) {
      queryBuilder.andWhere('bill.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('bill.createdAt <= :endDate', { endDate: params.endDate });
    }

    queryBuilder.orderBy('bill.createdAt', 'DESC');

    const bills = await queryBuilder.getMany();

    const statusMap: Record<number, string> = {
      1: '待支付', 2: '已支付', 3: '逾期', 4: '已豁免'
    };

    const data = bills.map(bill => ({
      '账单ID': bill.id,
      '账单编号': bill.billNo,
      '领养编号': bill.adoption?.adoptionNo || '',
      '用户手机号': bill.user?.phone || '',
      '账单月份': bill.billMonth,
      '账单金额': Number(bill.adjustedAmount || bill.originalAmount).toFixed(2),
      '滞纳金': Number(bill.lateFeeAmount || 0).toFixed(2),
      '状态': statusMap[bill.status] || '未知',
      '支付时间': bill.paidAt ? new Date(bill.paidAt).toLocaleString('zh-CN') : '',
      '创建时间': new Date(bill.createdAt).toLocaleString('zh-CN'),
    }));

    return this.generateExcelBase64(data, '饲料费账单');
  }

  /**
   * 生成Excel Base64
   */
  private generateExcelBase64(data: any[], sheetName: string): { base64: string; filename: string } {
    const XLSX = require('xlsx');

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 设置列宽
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length * 2, 15)
    }));
    worksheet['!cols'] = colWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 生成Base64
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');

    const filename = `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { base64, filename };
  }

  /**
   * 获取用户状态文本
   */
  private getUserStatusText(status: number): string {
    if (status === 1) {
      return '正常';
    }
    if (status === 2) {
      return '限制';
    }
    return '封禁';
  }

  /**
   * 获取订单状态文本
   */
  private getOrderStatusText(status: number): string {
    if (status === 1) {
      return '待支付';
    }
    if (status === 2) {
      return '已支付';
    }
    if (status === 3) {
      return '已取消';
    }
    return '已退款';
  }
}
