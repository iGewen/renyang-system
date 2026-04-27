import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceLog, User } from '@/entities';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceLog)
    private readonly balanceLogRepository: Repository<BalanceLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 获取用户余额
   */
  async getBalance(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'balance', 'nickname', 'phone', 'avatar'],
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return {
      balance: Number(user.balance),
      user,
    };
  }

  /**
   * 获取余额变动记录
   */
  async getBalanceLogs(userId: string, page: number = 1, pageSize: number = 20) {
    const [list, total] = await this.balanceLogRepository.findAndCount({
      where: { userId },
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
   * 获取充值记录
   */
  async getRechargeLogs(userId: string, page: number = 1, pageSize: number = 20) {
    const [list, total] = await this.balanceLogRepository.findAndCount({
      where: { userId, type: 1 }, // 1=充值
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
   * 获取消费记录
   */
  async getConsumeLogs(userId: string, page: number = 1, pageSize: number = 20) {
    const [list, total] = await this.balanceLogRepository.findAndCount({
      where: { userId, type: 2 }, // 2=消费
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
   * 创建余额变动记录（内部方法）
   */
  async createBalanceLog(params: {
    userId: string;
    type: number;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    relatedType?: string;
    relatedId?: string;
    remark?: string;
    operatorId?: string;
  }) {
    const log = this.balanceLogRepository.create({
      id: IdUtil.generate('BL'),
      ...params,
    });

    return this.balanceLogRepository.save(log);
  }
}
