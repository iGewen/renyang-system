import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, BalanceLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(BalanceLog)
    private balanceLogRepository: Repository<BalanceLog>,
    private redisService: RedisService,
  ) {}

  async findOne(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByPhone(phone: string) {
    return this.userRepository.findOne({ where: { phone } });
  }

  async updateBalance(userId: string, amount: number, remark: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('用户不存在');
    }

    // 确保余额转换为数字
    const balanceBefore = Number(user.balance) || 0;
    const changeAmount = Number(amount);
    const balanceAfter = balanceBefore + changeAmount;

    if (balanceAfter < 0) {
      throw new Error('余额不足');
    }

    // 更新余额 - 保留两位小数
    const finalBalance = Math.round(balanceAfter * 100) / 100;
    await this.userRepository.update(userId, { balance: finalBalance });

    // 记录流水
    const log = this.balanceLogRepository.create({
      id: `BL${Date.now()}`,
      userId,
      type: amount > 0 ? 1 : 2, // 1充值 2消费
      amount: Math.abs(changeAmount),
      balanceBefore,
      balanceAfter: finalBalance,
      remark,
    });
    await this.balanceLogRepository.save(log);

    // 更新缓存
    await this.redisService.set(`user:balance:${userId}`, finalBalance.toString());

    return { balanceBefore, balanceAfter: finalBalance };
  }

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
}
