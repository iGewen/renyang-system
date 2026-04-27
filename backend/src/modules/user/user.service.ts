import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, BalanceLog, Adoption } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BalanceLog)
    private readonly balanceLogRepository: Repository<BalanceLog>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
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
      return this.doUpdateBalance(userId, amount, remark);
    });
  }

  /**
   * 内部余额更新方法（无锁，供已有锁上下文调用）
   */
  async updateBalanceUnlocked(userId: string, amount: number, remark: string) {
    return this.doUpdateBalance(userId, amount, remark);
  }

  private async doUpdateBalance(userId: string, amount: number, remark: string) {
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
          id: IdUtil.generate('BL'), // 安全修复：使用 IdUtil 替代 Date.now()
          userId,
          type: amount > 0 ? 1 : 2, // 1充值 2消费
          amount: changeAmount, // 保留符号，支出为负数，收入为正数
          balanceBefore,
          balanceAfter: finalBalance,
          remark,
        });
        await manager.save(log);

        // 安全说明：缓存更新在事务外执行
        // 风险：如果缓存更新成功但事务后续回滚，会导致缓存与数据库不一致
        // 缓解措施：
        // 1. 缓存设置较短的过期时间（默认300秒）
        // 2. 读取余额时优先从数据库获取，缓存仅作为性能优化
        // 3. 关键操作（支付、退款）使用分布式锁确保一致性
        // 4. 缓存更新失败不影响事务结果（catch 忽略错误）
        this.redisService.set(`user:balance:${userId}`, finalBalance.toString()).catch(err => this.logger.warn(`更新余额缓存失败: ${err.message}`));

        return { balanceBefore, balanceAfter: finalBalance };
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

  /**
   * 查找用户并包含 password 字段（用于密码验证）
   * 修复 B-BIZ-004：User 实体的 password 字段设置了 select: false
   */
  async findOneWithPassword(id: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .addSelect('user.password')
      .getOne();
  }

  /**
   * 在事务中更新手机号并标记验证码已使用
   * 修复 B-BIZ-024：手机号更新和验证码标记应在同一事务中
   * 同时处理昵称同步：如果昵称是默认格式则自动更新
   */
  async updatePhoneWithCode(userId: string, newPhone: string, smsCodeId: string) {
    return this.dataSource.transaction(async (manager) => {
      // 获取用户当前信息
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      // 检查昵称是否为默认格式（"用户" + 旧手机号后4位）
      const oldPhoneSuffix = user.phone.slice(-4);
      const defaultNickname = `用户${oldPhoneSuffix}`;
      const shouldUpdateNickname = user.nickname === defaultNickname;

      // 准备更新数据
      const updateData: { phone: string; nickname?: string } = { phone: newPhone };
      if (shouldUpdateNickname) {
        updateData.nickname = `用户${newPhone.slice(-4)}`;
      }

      // 更新用户信息（手机号和可能的昵称）
      await manager.update(User, { id: userId }, updateData);
      // 标记验证码已使用
      await manager.update('SmsCode', { id: smsCodeId }, { isUsed: 1 });

      return { nicknameUpdated: shouldUpdateNickname };
    });
  }
}
