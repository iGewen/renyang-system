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
import { NotificationService } from '../notification/notification.service';
import { CryptoUtil } from '@/common/utils/crypto.util';

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
    private notificationService: NotificationService,
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
        forceChangePassword: admin.forceChangePassword === 1,
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
  async changePassword(adminId: string, oldPassword: string, newPassword: string, ip?: string) {
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
   * 更新用户状态
   */
  async updateUserStatus(userId: string, status: number, adminId: string, adminName: string, ip?: string) {
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
      remark: `更新用户状态为: ${status === 1 ? '正常' : status === 2 ? '受限' : '封禁'}`,
      ip,
    });

    return { success: true };
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: string, data: { nickname?: string; phone?: string }, adminId: string, adminName: string, ip?: string) {
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
    });

    return { success: true };
  }

  /**
   * 调整用户余额
   */
  async adjustUserBalance(userId: string, amount: number, reason: string, adminId: string, adminName: string, ip?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 确保余额转换为数字
    const beforeBalance = Number(user.balance) || 0;
    const changeAmount = Number(amount);
    const afterBalance = beforeBalance + changeAmount;

    if (afterBalance < 0) {
      throw new BadRequestException('余额不足');
    }

    // 更新余额 - 保留两位小数
    const finalBalance = Math.round(afterBalance * 100) / 100;
    await this.userRepository.update(userId, { balance: finalBalance });

    // 记录余额变动日志
    const balanceLog = this.dataSource.getRepository('BalanceLog').create({
      id: IdUtil.generate('BL'),
      userId,
      type: 4, // 调整
      amount: Math.abs(changeAmount),
      balanceBefore: beforeBalance,
      balanceAfter: finalBalance,
      relatedType: 'admin_adjust',
      remark: `管理员调整: ${reason}`,
    });
    await this.dataSource.getRepository('BalanceLog').save(balanceLog);

    await this.createAuditLog({
      adminId,
      adminName,
      module: 'user',
      action: 'adjust',
      targetType: 'user',
      targetId: userId,
      beforeData: { balance: beforeBalance },
      afterData: { balance: finalBalance, amount, reason },
      remark: `调整用户余额: ${changeAmount >= 0 ? '+' : ''}${changeAmount}元, 原因: ${reason}`,
      ip,
    });

    return { success: true, balance: finalBalance };
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
   */
  async deleteLivestock(id: string, adminId: string, adminName: string, ip?: string) {
    const livestock = await this.livestockRepository.findOne({ where: { id } });
    if (!livestock) {
      throw new NotFoundException('活体不存在');
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
  async updateSystemConfig(configKey: string, configValue: any, adminId: string, adminName: string, ip?: string) {
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
          statuses: [AdoptionStatus.ACTIVE, AdoptionStatus.FEED_OVERDUE, AdoptionStatus.CAN_REDEEM, AdoptionStatus.REDEMPTION_PENDING],
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
   */
  private encrypt(text: string): string {
    const key = this.configService.get('JWT_SECRET') || 'default-encryption-key-32chars!';
    return CryptoUtil.aesEncrypt(text, key);
  }

  /**
   * AES解密敏感配置
   */
  private decrypt(text: string): string {
    try {
      const key = this.configService.get('JWT_SECRET') || 'default-encryption-key-32chars!';
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
      await this.notificationService.createNotification({
        userId: redemption.userId,
        title: approved ? '买断申请已通过' : '买断申请已拒绝',
        content: approved
          ? `您的买断申请（编号：${redemption.redemptionNo}）已通过审核，请尽快完成支付。${adjustedAmount !== undefined ? `调整后金额：¥${adjustedAmount}` : `金额：¥${redemption.finalAmount}`}`
          : `您的买断申请（编号：${redemption.redemptionNo}）未通过审核。${remark ? `原因：${remark}` : ''}`,
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
          id: `N${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          userId,
          title: data.title,
          content: data.content,
          type: data.type,
        });
        await this.notificationRepository.save(notification);
        sendCount++;
      }
    } else {
      // 发送给所有用户（系统公告）
      const notification = this.notificationRepository.create({
        id: `N${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        title: data.title,
        content: data.content,
        type: 'system',
      });
      await this.notificationRepository.save(notification);
      sendCount = 1;
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
   */
  async clearAuditLogs(adminId: string, adminName: string, ip?: string) {
    // 记录清空操作日志
    await this.createAuditLog({
      adminId,
      adminName,
      module: 'audit_log',
      action: 'clear',
      targetType: 'audit_log',
      remark: '清空审计日志',
      isSensitive: 1,
      ip,
    });

    // 清空所有日志
    await this.auditLogRepository.clear();

    return { success: true };
  }
}
