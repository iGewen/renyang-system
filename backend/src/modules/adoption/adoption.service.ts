import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adoption, AdoptionStatus, FeedBill, FeedBillStatus, Order, OrderStatus, Livestock } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class AdoptionService {
  constructor(
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private feedBillRepository: Repository<FeedBill>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private redisService: RedisService,
  ) {}

  /**
   * 获取用户的领养列表
   */
  async getMyAdoptions(userId: string, status?: AdoptionStatus) {
    const queryBuilder = this.adoptionRepository.createQueryBuilder('adoption')
      .leftJoinAndSelect('adoption.livestock', 'livestock')
      .where('adoption.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('adoption.status = :status', { status });
    }

    queryBuilder.orderBy('adoption.createdAt', 'DESC');

    const adoptions = await queryBuilder.getMany();

    // 计算已领养天数
    return adoptions.map(adoption => ({
      ...adoption,
      days: Math.floor((Date.now() - new Date(adoption.startDate).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  /**
   * 获取领养详情
   */
  async getById(adoptionId: string, userId?: string) {
    const where: any = { id: adoptionId };
    if (userId) {
      where.userId = userId;
    }

    const adoption = await this.adoptionRepository.findOne({
      where,
      relations: ['livestock'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    return {
      ...adoption,
      days: Math.floor((Date.now() - new Date(adoption.startDate).getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  /**
   * 获取饲料费账单列表
   */
  async getFeedBills(adoptionId: string, userId: string) {
    return this.feedBillRepository.find({
      where: { adoptionId, userId },
      order: { billDate: 'DESC' },
    });
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
   * 支付饲料费
   */
  async payFeedBill(billId: string, userId: string, paymentMethod: string) {
    const bill = await this.feedBillRepository.findOne({
      where: { id: billId, userId },
      relations: ['adoption'],
    });

    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    if (bill.status !== FeedBillStatus.PENDING && bill.status !== FeedBillStatus.OVERDUE) {
      throw new BadRequestException('账单状态不允许支付');
    }

    // 计算应付金额
    const amount = (bill.adjustedAmount || bill.originalAmount) + bill.lateFeeAmount;

    if (amount <= 0) {
      // 金额为0，直接完成
      bill.status = FeedBillStatus.PAID;
      bill.paidAmount = 0;
      bill.paidAt = new Date();
      await this.feedBillRepository.save(bill);

      // 更新领养记录
      await this.updateAdoptionAfterPayment(bill.adoption);

      return { success: true, amount: 0 };
    }

    // 返回支付信息
    return {
      success: false,
      amount,
      billId: bill.id,
      billNo: bill.billNo,
    };
  }

  /**
   * 支付成功后更新账单
   */
  async handleFeedBillPaymentSuccess(billId: string, paymentNo: string, paymentMethod: string) {
    const bill = await this.feedBillRepository.findOne({
      where: { id: billId },
      relations: ['adoption'],
    });

    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    const amount = (bill.adjustedAmount || bill.originalAmount) + bill.lateFeeAmount;

    bill.status = FeedBillStatus.PAID;
    bill.paidAmount = amount;
    bill.paymentMethod = paymentMethod;
    bill.paymentNo = paymentNo;
    bill.paidAt = new Date();

    await this.feedBillRepository.save(bill);

    // 更新领养记录
    await this.updateAdoptionAfterPayment(bill.adoption);
  }

  /**
   * 支付成功后更新领养记录
   */
  private async updateAdoptionAfterPayment(adoption: Adoption) {
    // 更新已缴月数和总金额
    const paidBills = await this.feedBillRepository.count({
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

    await this.adoptionRepository.save(adoption);
  }

  /**
   * 申请买断
   */
  async applyRedemption(adoptionId: string, userId: string) {
    const adoption = await this.adoptionRepository.findOne({
      where: { id: adoptionId, userId },
      relations: ['livestock'],
    });

    if (!adoption) {
      throw new NotFoundException('领养记录不存在');
    }

    // 检查状态
    if (adoption.status !== AdoptionStatus.ACTIVE &&
        adoption.status !== AdoptionStatus.REDEEMABLE &&
        adoption.status !== AdoptionStatus.FEED_OVERDUE) {
      throw new BadRequestException('当前状态不允许申请买断');
    }

    // 检查是否有待支付的饲料费账单
    const unpaidBills = await this.feedBillRepository.count({
      where: { adoptionId, status: FeedBillStatus.PENDING },
    });

    if (unpaidBills > 0) {
      throw new BadRequestException('请先支付所有待缴饲料费');
    }

    // 计算买断金额
    const livestock = adoption.livestockSnapshot as Livestock;
    const requiredMonths = adoption.redemptionMonths - 1; // 首月免费
    const remainingMonths = Math.max(0, requiredMonths - adoption.feedMonthsPaid);
    const amount = remainingMonths * (livestock.monthlyFeedFee || 0);

    // 判断买断类型
    const type = remainingMonths === 0 ? 'full' : 'early';

    return {
      adoption,
      amount,
      type,
      feedMonthsPaid: adoption.feedMonthsPaid,
      requiredMonths,
      remainingMonths,
    };
  }

  /**
   * 检查并更新领养状态（定时任务调用）
   */
  async checkAndUpdateStatus() {
    // 检查可买断状态
    const adoptions = await this.adoptionRepository.find({
      where: { status: AdoptionStatus.ACTIVE },
    });

    for (const adoption of adoptions) {
      const requiredMonths = adoption.redemptionMonths - 1;
      if (adoption.feedMonthsPaid >= requiredMonths) {
        adoption.status = AdoptionStatus.REDEEMABLE;
        await this.adoptionRepository.save(adoption);
      }
    }
  }
}
