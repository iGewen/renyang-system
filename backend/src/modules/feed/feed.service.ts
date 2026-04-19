import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FeedBill, FeedBillStatus, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedBill)
    private feedBillRepository: Repository<FeedBill>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    private redisService: RedisService,
    private dataSource: DataSource,
  ) {}

  /**
   * 生成饲料费账单（定时任务调用）
   */
  async generateFeedBills() {
    // 获取所有领养中的记录
    const adoptions = await this.adoptionRepository.find({
      where: [
        { status: AdoptionStatus.ACTIVE },
        { status: AdoptionStatus.FEED_OVERDUE },
      ],
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const adoption of adoptions) {
      // 计算账单日期
      const startDate = new Date(adoption.startDate);
      const billDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + adoption.feedMonthsPaid + 1, // 跳过首月免费
        startDate.getDate()
      );

      // 提前5天生成账单
      const advanceDays = 5;
      const generateDate = new Date(billDate);
      generateDate.setDate(generateDate.getDate() - advanceDays);

      if (generateDate > today) {
        continue; // 还没到生成时间
      }

      // 检查是否已存在该月账单
      const billMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
      const existingBill = await this.feedBillRepository.findOne({
        where: { adoptionId: adoption.id, billMonth },
      });

      if (existingBill) {
        continue; // 账单已存在
      }

      // 获取活体信息
      const livestock = adoption.livestockSnapshot as any;
      const monthlyFeedFee = livestock?.monthlyFeedFee || 0;

      // 创建账单
      const bill = this.feedBillRepository.create({
        id: IdUtil.generate('FBL'),
        billNo: IdUtil.generateBillNo(),
        adoptionId: adoption.id,
        userId: adoption.userId,
        livestockId: adoption.livestockId,
        billMonth,
        billDate,
        originalAmount: monthlyFeedFee,
        lateFeeRate: 0.001, // 从配置获取
        lateFeeCap: monthlyFeedFee * 0.5, // 封顶50%
        lateFeeDays: 0,
        lateFeeAmount: 0,
        totalLateFee: 0,
        status: FeedBillStatus.PENDING,
        paidAmount: 0,
      });

      await this.feedBillRepository.save(bill);

      // TODO: 发送通知
    }
  }

  /**
   * 计算滞纳金（定时任务调用）
   */
  async calculateLateFees() {
    // 获取系统配置
    const configStr = await this.redisService.get('system:config');
    const config = configStr ? JSON.parse(configStr) : {
      lateFeeStartDays: 3,
      lateFeeRate: 0.001,
      lateFeeCapRate: 0.5,
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 获取所有待支付账单
    const overdueBills = await this.feedBillRepository.find({
      where: { status: FeedBillStatus.PENDING },
    });

    for (const bill of overdueBills) {
      const billDate = new Date(bill.billDate);
      const lateFeeStartDate = new Date(billDate);
      lateFeeStartDate.setDate(lateFeeStartDate.getDate() + config.lateFeeStartDays);

      if (today < lateFeeStartDate) {
        continue; // 还没到滞纳金开始时间
      }

      // 计算逾期天数
      const lateFeeDays = Math.floor((today.getTime() - lateFeeStartDate.getTime()) / (1000 * 60 * 60 * 24));

      // 计算滞纳金
      const amount = bill.adjustedAmount || bill.originalAmount;
      let lateFeeAmount = amount * config.lateFeeRate * lateFeeDays;
      const lateFeeCap = amount * config.lateFeeCapRate;

      // 检查是否达到上限
      if (lateFeeAmount > lateFeeCap) {
        lateFeeAmount = lateFeeCap;
      }

      // 更新账单
      bill.lateFeeDays = lateFeeDays;
      bill.lateFeeAmount = lateFeeAmount;
      // 修复：累加滞纳金而非覆盖
      bill.totalLateFee = (bill.totalLateFee || 0) + lateFeeAmount;
      bill.status = FeedBillStatus.OVERDUE;
      bill.lateFeeStartDate = lateFeeStartDate;

      await this.feedBillRepository.save(bill);

      // 检查是否需要标记异常（逾期7天）
      if (lateFeeDays >= 7) {
        await this.markAdoptionException(bill.adoptionId, '饲料费逾期超过7天');
      }
    }
  }

  /**
   * 标记领养异常
   */
  private async markAdoptionException(adoptionId: string, reason: string) {
    await this.adoptionRepository.update(
      { id: adoptionId, isException: 0 },
      {
        isException: 1,
        exceptionReason: reason,
        exceptionAt: new Date(),
        status: AdoptionStatus.EXCEPTION,
      },
    );
  }

  /**
   * 调整饲料费金额
   */
  async adjustFeedBill(billId: string, adjustedAmount: number, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.adjustedAmount = adjustedAmount;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;

    await this.feedBillRepository.save(bill);
    return bill;
  }

  /**
   * 免除饲料费
   */
  async waiveFeedBill(billId: string, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.status = FeedBillStatus.WAIVED;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;
    bill.paidAmount = 0;

    await this.feedBillRepository.save(bill);
    return bill;
  }

  /**
   * 免除滞纳金
   */
  async waiveLateFee(billId: string, reason: string, operatorId: string) {
    const bill = await this.feedBillRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    bill.lateFeeAmount = 0;
    bill.totalLateFee = 0;
    bill.adjustReason = reason;
    bill.operatorId = operatorId;

    await this.feedBillRepository.save(bill);
    return bill;
  }

  /**
   * 获取用户的饲料费账单
   */
  async getMyFeedBills(userId: string, adoptionId?: string) {
    const queryBuilder = this.feedBillRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.livestock', 'livestock')
      .leftJoinAndSelect('bill.adoption', 'adoption')
      .where('bill.userId = :userId', { userId });

    if (adoptionId) {
      queryBuilder.andWhere('bill.adoptionId = :adoptionId', { adoptionId });
    }

    queryBuilder.orderBy('bill.billDate', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * 获取饲料费账单详情
   */
  async getFeedBillById(billId: string, userId?: string) {
    const where: any = { id: billId };
    if (userId) {
      where.userId = userId;
    }

    return this.feedBillRepository.findOne({
      where,
      relations: ['livestock', 'adoption'],
    });
  }

  /**
   * 支付成功后更新账单
   */
  async handleFeedBillPaymentSuccess(billId: string, paymentNo: string, paymentMethod: string) {
    // 使用分布式锁确保幂等性
    const lockKey = `feed:payment:${billId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      // 使用事务确保原子性
      return this.dataSource.transaction(async (manager) => {
        const bill = await manager.findOne(FeedBill, {
          where: { id: billId },
          relations: ['adoption'],
        });

        if (!bill) {
          throw new NotFoundException('账单不存在');
        }

        // 幂等检查：如果已支付，直接返回
        if (bill.status === FeedBillStatus.PAID) {
          return bill;
        }

        // 再次检查账单状态是否允许支付
        if (bill.status !== FeedBillStatus.PENDING && bill.status !== FeedBillStatus.OVERDUE) {
          throw new BadRequestException('账单状态不允许支付');
        }

        const amount = (bill.adjustedAmount || bill.originalAmount) + bill.lateFeeAmount;

        bill.status = FeedBillStatus.PAID;
        bill.paidAmount = amount;
        bill.paymentMethod = paymentMethod;
        bill.paymentNo = paymentNo;
        bill.paidAt = new Date();

        await manager.save(bill);

        // 更新领养记录
        await this.updateAdoptionAfterPaymentWithManager(bill.adoption, manager);
      });
    });
  }

  /**
   * 支付成功后更新领养记录（使用事务管理器）
   */
  private async updateAdoptionAfterPaymentWithManager(adoption: Adoption, manager: any) {
    // 更新已缴月数和总金额
    const paidBills = await manager.count(FeedBill, {
      where: { adoptionId: adoption.id, status: FeedBillStatus.PAID },
    });

    adoption.feedMonthsPaid = paidBills;

    // 检查是否达到买断条件
    // 首月免费，所以实际需要缴纳 月数-1
    const requiredMonths = adoption.redemptionMonths - 1;
    if (paidBills >= requiredMonths && adoption.status === AdoptionStatus.ACTIVE) {
      adoption.status = AdoptionStatus.REDEEMABLE;
    }

    // 如果之前是逾期状态，恢复为正常
    if (adoption.status === AdoptionStatus.FEED_OVERDUE) {
      adoption.status = AdoptionStatus.ACTIVE;
    }

    await manager.save(adoption);
  }

  /**
   * 获取异常领养列表
   */
  async getExceptionAdoptions(page: number = 1, pageSize: number = 10) {
    const [list, total] = await this.adoptionRepository.findAndCount({
      where: { isException: 1 },
      order: { exceptionAt: 'DESC' },
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
   * 处理异常领养
   */
  async resolveException(adoptionId: string, action: 'contact' | 'terminate' | 'continue', remark: string) {
    const adoption = await this.adoptionRepository.findOne({ where: { id: adoptionId } });
    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    switch (action) {
      case 'contact':
        // 仅记录，不做状态变更
        break;
      case 'terminate':
        adoption.status = AdoptionStatus.TERMINATED;
        break;
      case 'continue':
        adoption.status = AdoptionStatus.ACTIVE;
        adoption.isException = 0;
        adoption.exceptionReason = null as any;
        adoption.exceptionAt = null as any;
        break;
    }

    await this.adoptionRepository.save(adoption);
    return adoption;
  }

  /**
   * 获取饲料费账单列表（管理员）
   */
  async getFeedBillList(params: {
    page: number;
    pageSize: number;
    status?: number;
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
}
