import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, BalanceLog, Adoption } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(BalanceLog)
    private balanceLogRepository: Repository<BalanceLog>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    private redisService: RedisService,
    private dataSource: DataSource,
  ) {}

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return null;
    }

    // 获取领养统计数据
    const adoptions = await this.adoptionRepository.find({ where: { userId: id } });
    const adoptionsCount = adoptions.length;
    // 计算总领养天数
    const totalDays = adoptions.reduce((sum, adoption) => {
      const startDate = new Date(adoption.startDate);
      const now = new Date();
      const days = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + Math.max(0, days);
    }, 0);

    return {
      ...user,
      stats: {
        adoptions: adoptionsCount,
        days: totalDays,
      },
    };
  }

  async findByPhone(phone: string) {
    return this.userRepository.findOne({ where: { phone } });
  }

  async updateProfile(userId: string, data: { nickname?: string }) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 验证昵称
    if (data.nickname !== undefined) {
      const trimmedNickname = data.nickname.trim();
      if (trimmedNickname.length === 0) {
        throw new BadRequestException('昵称不能为空');
      }
      if (trimmedNickname.length > 20) {
        throw new BadRequestException('昵称最多20个字符');
      }
      user.nickname = trimmedNickname;
    }

    await this.userRepository.save(user);

    // 返回更新后的用户信息
    return this.findOne(userId);
  }

  async updateBalance(userId: string, amount: number, remark: string) {
    // 使用分布式锁防止并发操作导致余额计算错误
    const lockKey = `user:balance:${userId}`;
    return this.redisService.withLock(lockKey, 10000, async () => {
      // 使用事务确保余额更新和日志记录的原子性
      return this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, { where: { id: userId } });
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
        user.balance = finalBalance;
        await manager.save(user);

        // 记录流水
        const log = manager.create(BalanceLog, {
          id: `BL${Date.now()}`,
          userId,
          type: amount > 0 ? 1 : 2, // 1充值 2消费
          amount: Math.abs(changeAmount),
          balanceBefore,
          balanceAfter: finalBalance,
          remark,
        });
        await manager.save(log);

        // 更新缓存（在事务外执行，失败不影响事务）
        this.redisService.set(`user:balance:${userId}`, finalBalance.toString()).catch(() => {});

        return { balanceBefore, balanceAfter: finalBalance };
      });
    });
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

  async updatePassword(userId: string, hashedPassword: string) {
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  async updatePhone(userId: string, phone: string) {
    await this.userRepository.update(userId, { phone });
  }
}
