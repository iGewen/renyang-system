import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like, Between, In } from 'typeorm';
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

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Livestock)
    private livestockRepository: Repository<Livestock>,
    @InjectRepository(LivestockType)
    private livestockTypeRepository: Repository<LivestockType>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private feedBillRepository: Repository<FeedBill>,
    @InjectRepository(RedemptionOrder)
    private redemptionOrderRepository: Repository<RedemptionOrder>,
    @InjectRepository(RefundOrder)
    private refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private redisService: RedisService,
    private dataSource: DataSource,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  // =============== 管理员认证相关 ===============

  /**
   * 管理员登录
   */
  async login(username: string, password: string, ip: string) {
    const admin = await this.adminRepository
      .createQueryBuilder('admin')
      .where('admin.username = :username', { username })
      .addSelect('admin.password')
      .getOne();

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 更新最后登录信息
    await this.adminRepository.update(admin.id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    // 生成token
    const token = this.jwtService.sign({
      sub: admin.id,
      username: admin.username,
      type: 'admin',
      role: admin.role,
    });

    // 记录登录日志
    await this.createAuditLog({
      adminId: admin.id,
      adminName: admin.username,
      module: 'auth',
      action: 'login',
      remark: '管理员登录',
      ip,
    });

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        avatar: admin.avatar,
      },
    };
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
  async changePassword(adminId: string, oldPassword: string, newPassword: string) {
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.adminRepository.update(adminId, { password: hashedPassword });

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
   * 更新用户状态
   */
  async updateUserStatus(userId: string, status: number, adminId: string, adminName: string) {
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
      remark: `更新用户状态为: ${status === 1 ? '启用' : '禁用'}`,
    });

    return { success: true };
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
  async createLivestockType(data: Partial<LivestockType>, adminId: string, adminName: string) {
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
    });

    return type;
  }

  /**
   * 更新活体类型
   */
  async updateLivestockType(id: string, data: Partial<LivestockType>, adminId: string, adminName: string) {
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
    });

    return type;
  }

  /**
   * 删除活体类型
   */
  async deleteLivestockType(id: string, adminId: string, adminName: string) {
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
  async createLivestock(data: Partial<Livestock>, adminId: string, adminName: string) {
    const livestock = this.livestockRepository.create({
      id: IdUtil.generate('L'),
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
    });

    return livestock;
  }

  /**
   * 更新活体
   */
  async updateLivestock(id: string, data: Partial<Livestock>, adminId: string, adminName: string) {
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
    });

    return livestock;
  }

  /**
   * 更新活体状态
   */
  async updateLivestockStatus(id: string, status: number, adminId: string, adminName: string) {
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
    });

    return { success: true };
  }

  // =============== 订单管理 ===============

  /**
   * 获取订单列表
   */
  async getOrderList(params: {
    page: number;
    pageSize: number;
    status?: OrderStatus;
    orderType?: string;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.livestock', 'livestock');

    if (params.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', { status: params.status });
    }

    if (params.orderType) {
      queryBuilder.andWhere('order.orderType = :orderType', { orderType: params.orderType });
    }

    if (params.keyword) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :keyword OR user.phone LIKE :keyword OR user.nickname LIKE :keyword)',
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

  /**
   * 更新系统配置
   */
  async updateSystemConfig(configKey: string, configValue: any, adminId: string, adminName: string) {
    let config = await this.systemConfigRepository.findOne({
      where: { configKey },
    });

    const valueStr = typeof configValue === 'string'
      ? configValue
      : JSON.stringify(configValue);

    if (config) {
      const beforeData = config.configValue;
      config.configValue = valueStr;
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
        configType: 'other',
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
        .select('SUM(order.amount)', 'total')
        .getRawOne(),
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
      todayRevenue: todayRevenue?.total || 0,
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
  async createAdmin(data: { username: string; password: string; name?: string; phone?: string; role: number }, adminId: string, adminName: string) {
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
  async updateAdminStatus(targetAdminId: string, status: number, adminId: string, adminName: string) {
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
   * 简单加密（实际应用中应使用更安全的方式）
   */
  private encrypt(text: string): string {
    return Buffer.from(text).toString('base64');
  }

  /**
   * 简单解密
   */
  private decrypt(text: string): string {
    return Buffer.from(text, 'base64').toString();
  }

  /**
   * 发送系统公告
   */
  async sendSystemAnnouncement(title: string, content: string, adminId: string, adminName: string) {
    const notification = this.notificationRepository.create({
      id: `N${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
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
    });

    return notification;
  }
}
