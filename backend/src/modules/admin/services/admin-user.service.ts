import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, Adoption, Order, AuditLog } from '@/entities';
import { IdUtil } from '@/common/utils/id.util';
import { AdminService } from '../admin.service';
import { normalizePagination } from '@/common/utils/pagination.util';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly adminService: AdminService,
  ) {}

  /**
   * 获取用户列表
   */
  async getUserList(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    status?: number;
  }) {
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);
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
      .skip(skip)
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
   * 获取用户领养记录
   */
  async getUserAdoptions(userId: string) {
    const adoptions = await this.adoptionRepository.find({
      where: { userId },
      relations: ['livestock'],
      order: { createdAt: 'DESC' },
    });
    return adoptions;
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
      .andWhere('payment.status != :failedStatus', { failedStatus: 3 }) // 排除支付失败记录
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

    await this.adminService.createAuditLog({
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

    await this.adminService.createAuditLog({
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

    await this.adminService.createAuditLog({
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
}
