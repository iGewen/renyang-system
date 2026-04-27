import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, BalanceLog, PaymentRecord, Order, Adoption, FeedBill, RedemptionOrder, RefundOrder, PaymentStatus } from '@/entities';

/**
 * 统一交易记录格式
 */
export interface TransactionRecord {
  id: string;
  transactionNo: string;       // 交易单号
  type: 'payment' | 'refund' | 'recharge' | 'adjust';  // 交易类型
  typeLabel: string;           // 类型显示名
  amount: number;              // 金额（正数=收入，负数=支出）
  paymentMethod: string;       // 支付方式：balance/alipay/wechat
  paymentMethodLabel: string;  // 支付方式显示名
  status: number;              // 状态
  statusLabel: string;         // 状态显示名
  createdAt: Date;             // 交易时间
  // 关联信息
  orderType?: string;          // 订单类型
  orderId?: string;            // 订单ID
  orderNo?: string;            // 订单编号
  transactionId?: string;      // 第三方交易号
  productName?: string;        // 商品名称
  remark?: string;             // 备注
  // 退款相关
  originalPaymentNo?: string;  // 原支付单号
  refundNo?: string;           // 退款单号
  refundReason?: string;       // 退款原因
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BalanceLog)
    private readonly balanceLogRepository: Repository<BalanceLog>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    @InjectRepository(FeedBill)
    private readonly feedBillRepository: Repository<FeedBill>,
    @InjectRepository(RedemptionOrder)
    private readonly redemptionOrderRepository: Repository<RedemptionOrder>,
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
  ) {}

  /**
   * 获取钱包概览
   */
  async getWalletOverview(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'balance', 'nickname', 'phone', 'avatar'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      balance: Number(user.balance),
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        avatar: user.avatar,
      },
    };
  }

  /**
   * 获取交易记录列表
   */
  async getTransactions(
    userId: string,
    params: {
      page?: number;
      pageSize?: number;
      type?: string;           // payment/refund/recharge/adjust
      paymentMethod?: string;  // balance/alipay/wechat
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 50);

    // 构建基础查询条件
    const paymentQuery = this.paymentRecordRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .andWhere('payment.status = :status', { status: PaymentStatus.SUCCESS });

    const balanceQuery = this.balanceLogRepository
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId });

    // 类型筛选
    if (params.type) {
      if (params.type === 'payment') {
        paymentQuery.andWhere('payment.orderType != :recharge', { recharge: 'recharge' });
      } else if (params.type === 'recharge') {
        paymentQuery.andWhere('payment.orderType = :recharge', { recharge: 'recharge' });
      } else if (params.type === 'refund') {
        balanceQuery.andWhere('log.type = :refundType', { refundType: 3 });
      } else if (params.type === 'adjust') {
        balanceQuery.andWhere('log.type = :adjustType', { adjustType: 4 });
      }
    }

    // 支付方式筛选
    if (params.paymentMethod) {
      if (params.paymentMethod === 'balance') {
        paymentQuery.andWhere('payment.paymentMethod = :method', { method: 'balance' });
        balanceQuery.andWhere('1 = 0'); // balance_logs都是余额
      } else {
        paymentQuery.andWhere('payment.paymentMethod = :method', { method: params.paymentMethod });
        balanceQuery.andWhere('1 = 0'); // 非余额时排除balance_logs
      }
    }

    // 时间筛选
    if (params.startDate) {
      const start = new Date(params.startDate);
      paymentQuery.andWhere('payment.paidAt >= :start', { start });
      balanceQuery.andWhere('log.createdAt >= :start', { start });
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      paymentQuery.andWhere('payment.paidAt <= :end', { end });
      balanceQuery.andWhere('log.createdAt <= :end', { end });
    }

    // 获取总数
    const [paymentTotal, balanceTotal] = await Promise.all([
      paymentQuery.getCount(),
      balanceQuery.getCount(),
    ]);
    const total = paymentTotal + balanceTotal;

    // 分页获取数据
    const offset = (page - 1) * pageSize;

    // 获取支付记录
    const payments = await paymentQuery
      .orderBy('payment.paidAt', 'DESC')
      .skip(Math.max(0, offset))
      .take(pageSize)
      .getMany();

    // 获取余额变动记录（退款、调整）
    const balanceLogs = await balanceQuery
      .orderBy('log.createdAt', 'DESC')
      .getMany();

    // 转换为统一格式
    const paymentRecords = await this.convertPaymentsToTransactions(payments);
    const balanceRecords = this.convertBalanceLogsToTransactions(balanceLogs);

    // 合并并排序
    let allRecords = [...paymentRecords, ...balanceRecords];
    allRecords.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    // 如果支付记录不够，补充余额变动记录
    if (paymentRecords.length < pageSize && offset === 0) {
      // 第一页，已合并
    } else {
      // 分页裁剪
      allRecords = allRecords.slice(0, pageSize);
    }

    return {
      list: allRecords,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取交易详情
   */
  async getTransactionDetail(userId: string, transactionNo: string) {
    // 先查支付记录
    const payment = await this.paymentRecordRepository.findOne({
      where: { paymentNo: transactionNo, userId },
    });

    if (payment) {
      return this.getPaymentDetail(payment);
    }

    // 再查余额变动记录
    const balanceLog = await this.balanceLogRepository.findOne({
      where: { id: transactionNo, userId },
    });

    if (balanceLog) {
      return this.getBalanceLogDetail(balanceLog);
    }

    throw new NotFoundException('交易记录不存在');
  }

  /**
   * 转换支付记录为统一交易格式
   */
  private async convertPaymentsToTransactions(payments: PaymentRecord[]): Promise<TransactionRecord[]> {
    if (payments.length === 0) return [];

    // 收集所有订单ID（排除充值订单）
    const orderIds = payments.filter(p => p.orderType !== 'recharge').map(p => p.orderId);

    // 批量查询订单信息
    const orders = orderIds.length > 0
      ? await this.orderRepository.find({ where: { id: In(orderIds) } })
      : [];
    const orderMap = new Map(orders.map(o => [o.id, o]));

    // 查询领养信息获取商品名称
    const adoptions = orders.length > 0
      ? await this.adoptionRepository.find({ where: { orderId: In(orders.map(o => o.id)) } })
      : [];
    const adoptionMap = new Map(adoptions.map(a => [a.orderId, a]));

    return payments.map(payment => {
      const isRecharge = payment.orderType === 'recharge';
      const order = orderMap.get(payment.orderId);
      const adoption = adoptionMap.get(payment.orderId);

      let typeLabel = '支付';
      let productName = '';
      let orderNo = '';

      if (isRecharge) {
        typeLabel = '充值';
        productName = '账户充值';
        orderNo = payment.outTradeNo || '';
      } else if (payment.orderType === 'adoption') {
        typeLabel = '领养支付';
        productName = adoption?.livestockSnapshot?.name || order?.livestockSnapshot?.name || '领养商品';
        orderNo = order?.orderNo || '';
      } else if (payment.orderType === 'feed') {
        typeLabel = '饲料费';
        productName = '饲料费缴纳';
        orderNo = order?.orderNo || '';
      } else if (payment.orderType === 'redemption') {
        typeLabel = '买断支付';
        productName = '买断支付';
        orderNo = order?.orderNo || '';
      }

      return {
        id: payment.id,
        transactionNo: payment.paymentNo,
        type: isRecharge ? 'recharge' : 'payment',
        typeLabel,
        amount: -Math.abs(Number(payment.amount)), // 支出为负
        paymentMethod: payment.paymentMethod,
        paymentMethodLabel: this.getPaymentMethodLabel(payment.paymentMethod),
        status: payment.status,
        statusLabel: payment.status === PaymentStatus.SUCCESS ? '交易成功' : '待支付',
        createdAt: payment.paidAt || payment.createdAt,
        orderType: payment.orderType,
        orderId: payment.orderId,
        orderNo,
        transactionId: payment.transactionId,
        productName,
      };
    });
  }

  /**
   * 转换余额变动记录为统一交易格式
   */
  private convertBalanceLogsToTransactions(logs: BalanceLog[]): TransactionRecord[] {
    return logs.map(log => {
      let type: 'refund' | 'adjust' | 'recharge' = 'adjust';
      let typeLabel = '余额变动';

      if (log.type === 3) {
        type = 'refund';
        typeLabel = '退款';
      } else if (log.type === 4) {
        type = 'adjust';
        typeLabel = '余额调整';
      } else if (log.type === 1) {
        type = 'recharge';
        typeLabel = '充值';
      }

      // 金额：退款和充值为正，其他根据amount判断
      let amount = Number(log.amount);
      if (log.type === 3) {
        amount = Math.abs(amount); // 退款为正
      } else if (log.type === 1) {
        amount = Math.abs(amount); // 充值为正
      }

      return {
        id: log.id,
        transactionNo: log.id,
        type,
        typeLabel,
        amount,
        paymentMethod: 'balance',
        paymentMethodLabel: '余额',
        status: 2, // 已完成
        statusLabel: '已完成',
        createdAt: log.createdAt,
        remark: log.remark,
        orderId: log.relatedId,
      };
    });
  }

  /**
   * 获取支付记录详情
   */
  private async getPaymentDetail(payment: PaymentRecord) {
    const baseInfo = {
      id: payment.id,
      transactionNo: payment.paymentNo,
      type: payment.orderType === 'recharge' ? 'recharge' : 'payment',
      amount: -Math.abs(Number(payment.amount)),
      paymentMethod: payment.paymentMethod,
      paymentMethodLabel: this.getPaymentMethodLabel(payment.paymentMethod),
      status: payment.status,
      statusLabel: payment.status === PaymentStatus.SUCCESS ? '交易成功' : '待支付',
      createdAt: payment.paidAt || payment.createdAt,
      transactionId: payment.transactionId,
      outTradeNo: payment.outTradeNo,
    };

    // 充值记录
    if (payment.orderType === 'recharge') {
      return {
        ...baseInfo,
        typeLabel: '充值',
        productName: '账户充值',
      };
    }

    // 查询关联订单
    const order = await this.orderRepository.findOne({ where: { id: payment.orderId } });

    // 领养支付
    if (payment.orderType === 'adoption') {
      const adoption = await this.adoptionRepository.findOne({
        where: { orderId: payment.orderId },
      });

      return {
        ...baseInfo,
        typeLabel: '领养支付',
        orderNo: order?.orderNo,
        adoptionNo: adoption?.adoptionNo,
        productName: adoption?.livestockSnapshot?.name || order?.livestockSnapshot?.name || '领养商品',
        livestockName: adoption?.livestockSnapshot?.name,
        orderInfo: order ? {
          orderNo: order.orderNo,
          totalAmount: Number(order.totalAmount),
          status: order.status,
        } : null,
        adoptionInfo: adoption ? {
          adoptionNo: adoption.adoptionNo,
          status: adoption.status,
        } : null,
      };
    }

    // 饲料费
    if (payment.orderType === 'feed') {
      const feedBill = await this.feedBillRepository.findOne({
        where: { id: payment.orderId },
      });
      const adoption = feedBill ? await this.adoptionRepository.findOne({
        where: { id: feedBill.adoptionId },
      }) : null;

      return {
        ...baseInfo,
        typeLabel: '饲料费缴纳',
        feedBillNo: feedBill?.billNo,
        adoptionNo: adoption?.adoptionNo,
        productName: '饲料费缴纳',
        feedBillInfo: feedBill ? {
          billNo: feedBill.billNo,
          billMonth: feedBill.billMonth,
          amount: Number(feedBill.finalAmount),
        } : null,
      };
    }

    // 买断支付
    if (payment.orderType === 'redemption') {
      const redemption = await this.redemptionOrderRepository.findOne({
        where: { id: payment.orderId },
      });
      const adoption = redemption ? await this.adoptionRepository.findOne({
        where: { id: redemption.adoptionId },
      }) : null;

      return {
        ...baseInfo,
        typeLabel: '买断支付',
        redemptionNo: redemption?.redemptionNo,
        adoptionNo: adoption?.adoptionNo,
        productName: '买断支付',
        redemptionInfo: redemption ? {
          redemptionNo: redemption.redemptionNo,
          finalAmount: Number(redemption.finalAmount),
          type: redemption.type,
        } : null,
      };
    }

    return baseInfo;
  }

  /**
   * 获取余额变动详情
   */
  private async getBalanceLogDetail(log: BalanceLog) {
    const baseInfo = {
      id: log.id,
      transactionNo: log.id,
      amount: Number(log.amount),
      paymentMethod: 'balance',
      paymentMethodLabel: '余额',
      status: 2,
      statusLabel: '已完成',
      createdAt: log.createdAt,
      remark: log.remark,
      balanceBefore: Number(log.balanceBefore),
      balanceAfter: Number(log.balanceAfter),
    };

    // 退款
    if (log.type === 3 && log.relatedType === 'refund') {
      const refund = await this.refundOrderRepository.findOne({
        where: { id: log.relatedId },
      });
      const order = refund ? await this.orderRepository.findOne({
        where: { id: refund.orderId },
      }) : null;
      const adoption = order ? await this.adoptionRepository.findOne({
        where: { orderId: order.id },
      }) : null;

      return {
        ...baseInfo,
        type: 'refund',
        typeLabel: '退款',
        refundNo: refund?.refundNo,
        refundReason: refund?.reason,
        refundMethod: refund?.refundMethod,
        orderNo: order?.orderNo,
        adoptionNo: adoption?.adoptionNo,
        refundInfo: refund ? {
          refundNo: refund.refundNo,
          refundAmount: Number(refund.refundAmount),
          reason: refund.reason,
          refundAt: refund.refundAt,
        } : null,
      };
    }

    // 充值（余额方式）
    if (log.type === 1) {
      return {
        ...baseInfo,
        type: 'recharge',
        typeLabel: '充值',
      };
    }

    // 调整
    return {
      ...baseInfo,
      type: 'adjust',
      typeLabel: '余额调整',
      operatorId: log.operatorId,
    };
  }

  /**
   * 获取支付方式显示名
   */
  private getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      balance: '余额',
      alipay: '支付宝',
      wechat: '微信支付',
    };
    return labels[method] || method;
  }
}