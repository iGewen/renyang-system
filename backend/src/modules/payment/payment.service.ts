import { Injectable, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentRecord, PaymentStatus, OrderStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { OrderService } from '../order/order.service';
import { UserService } from '../user/user.service';
import { AlipayService } from '@/services/alipay.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { RedemptionService } from '../redemption/redemption.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentRecord)
    private paymentRepository: Repository<PaymentRecord>,
    private configService: ConfigService,
    private redisService: RedisService,
    private orderService: OrderService,
    private userService: UserService,
    private alipayService: AlipayService,
    private wechatPayService: WechatPayService,
    @Inject(forwardRef(() => RedemptionService))
    private redemptionService: RedemptionService,
  ) {}

  /**
   * 创建支付
   */
  async createPayment(
    userId: string,
    orderType: string,
    orderId: string,
    amount: number,
    paymentMethod: string,
  ) {
    // 安全修复：验证支付金额与实际订单金额是否一致
    let expectedAmount: number;

    switch (orderType) {
      case 'adoption': {
        const order = await this.orderService.getById(orderId);
        if (!order) {
          throw new BadRequestException('订单不存在');
        }
        if (order.userId !== userId) {
          throw new BadRequestException('无权支付此订单');
        }
        // 检查订单状态是否为待支付
        if (order.status !== OrderStatus.PENDING_PAYMENT) {
          throw new BadRequestException('订单已过期或已支付，请返回订单列表查看');
        }
        expectedAmount = Number(order.totalAmount) - Number(order.paidAmount || 0);
        break;
      }
      case 'redemption': {
        const redemption = await this.redemptionService.getRedemptionDetail(orderId, userId);
        if (!redemption) {
          throw new BadRequestException('买断订单不存在');
        }
        expectedAmount = Number(redemption.finalAmount) || 0;
        break;
      }
      case 'feed': {
        // 饲料费需要从饲料账单中获取金额
        const feedBill = await this.paymentRepository.manager.findOne('FeedBill' as any, {
          where: { id: orderId },
        }) as any;
        if (!feedBill) {
          throw new BadRequestException('饲料账单不存在');
        }
        // 使用 adjustedAmount 或 originalAmount，而非 amount
        expectedAmount = Number(feedBill.adjustedAmount || feedBill.originalAmount) + Number(feedBill.lateFeeAmount || 0);
        break;
      }
      case 'recharge': {
        // 充值金额由用户指定，但需要验证最小金额
        if (amount <= 0) {
          throw new BadRequestException('充值金额必须大于0');
        }
        expectedAmount = amount;
        break;
      }
      default:
        throw new BadRequestException('不支持的订单类型');
    }

    // 验证金额（允许0.01的误差，处理浮点数精度问题）
    if (orderType !== 'recharge' && Math.abs(amount - expectedAmount) > 0.01) {
      throw new BadRequestException('支付金额与订单金额不符');
    }

    // 创建支付记录
    const payment = this.paymentRepository.create({
      id: IdUtil.generate('PAY'),
      paymentNo: IdUtil.generatePaymentNo(),
      outTradeNo: orderId,
      userId,
      orderType,
      orderId,
      amount,
      paymentMethod,
      status: PaymentStatus.PENDING,
    });

    await this.paymentRepository.save(payment);

    // 根据支付方式返回支付URL
    if (paymentMethod === 'balance') {
      return this.payWithBalance(payment);
    } else if (paymentMethod === 'alipay') {
      return this.createAlipayPayment(payment);
    } else if (paymentMethod === 'wechat') {
      return this.createWechatPayment(payment);
    }

    throw new BadRequestException('不支持的支付方式');
  }

  /**
   * 余额支付
   */
  private async payWithBalance(payment: PaymentRecord) {
    const lockKey = `payment:balance:${payment.userId}`;

    return this.redisService.withLock(lockKey, 30000, async () => {
      // 检查余额 - 重新从数据库获取最新余额
      const user = await this.userService.findOne(payment.userId);
      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      // 确保余额转换为数字进行比较
      const userBalance = Number(user.balance);
      const paymentAmount = Number(payment.amount);

      if (isNaN(userBalance) || isNaN(paymentAmount)) {
        throw new BadRequestException('余额数据异常');
      }

      if (userBalance < paymentAmount) {
        throw new BadRequestException('余额不足，请充值后重试');
      }

      // 扣减余额
      await this.userService.updateBalance(
        payment.userId,
        -paymentAmount,
        `支付订单: ${payment.outTradeNo}`,
      );

      // 处理支付成功（会更新状态为SUCCESS并处理订单）
      await this.handlePaymentSuccess(payment);

      return { paymentNo: payment.paymentNo };
    });
  }

  /**
   * 支付宝H5支付
   */
  private async createAlipayPayment(payment: PaymentRecord) {
    const result = await this.alipayService.createH5Payment(
      payment.paymentNo,
      payment.amount,
      '订单支付',
      `订单号: ${payment.outTradeNo}`,
    );

    return {
      payUrl: result.payUrl,
      paymentNo: payment.paymentNo,
    };
  }

  /**
   * 微信H5支付
   */
  private async createWechatPayment(payment: PaymentRecord, clientIp?: string) {
    const result = await this.wechatPayService.createH5Payment(
      payment.paymentNo,
      payment.amount,
      '订单支付',
      clientIp || '127.0.0.1',
    );

    return {
      payUrl: result.payUrl,
      prepayId: result.prepayId,
      paymentNo: payment.paymentNo,
    };
  }

  /**
   * 获取支付宝支付URL
   */
  async getAlipayPayUrl(paymentNo: string) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo },
    });

    if (!payment) {
      throw new BadRequestException('支付记录不存在');
    }

    return this.createAlipayPayment(payment);
  }

  /**
   * 获取微信支付URL
   */
  async getWechatPayUrl(paymentNo: string, clientIp: string) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo },
    });

    if (!payment) {
      throw new BadRequestException('支付记录不存在');
    }

    return this.createWechatPayment(payment, clientIp);
  }

  /**
   * 处理支付成功
   * 注意：此方法可能被多次调用（余额支付直接调用、回调通知调用）
   * 需要保证幂等性，但不能跳过业务处理
   */
  async handlePaymentSuccess(payment: PaymentRecord) {
    // 使用分布式锁确保幂等处理
    const lockKey = `payment:success:${payment.paymentNo}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      // 重新从数据库获取最新的支付记录状态
      const latestPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
      });

      if (!latestPayment) {
        return;
      }

      // 如果已经处理过（状态已是SUCCESS且有paidAt），直接返回
      if (latestPayment.status === PaymentStatus.SUCCESS && latestPayment.paidAt) {
        return;
      }

      // 更新支付状态
      latestPayment.status = PaymentStatus.SUCCESS;
      latestPayment.paidAt = new Date();
      await this.paymentRepository.save(latestPayment);

      // 根据订单类型处理
      switch (latestPayment.orderType) {
        case 'adoption':
          await this.orderService.handlePaymentSuccess(
            latestPayment.orderId,
            latestPayment.paymentNo,
            latestPayment.paymentMethod,
          );
          break;
        case 'feed':
          // 饲料费支付成功，由 FeedService 处理
          break;
        case 'redemption':
          // 处理买断支付
          await this.redemptionService.handlePaymentSuccess(
            latestPayment.orderId,
            latestPayment.paymentNo,
            latestPayment.paymentMethod,
          );
          break;
        case 'recharge':
          // 余额充值
          await this.userService.updateBalance(
            latestPayment.userId,
            latestPayment.amount,
            `余额充值: ${latestPayment.paymentNo}`,
          );
          break;
      }
    });
  }

  /**
   * 支付宝回调
   * 安全修复：添加签名验证，防止伪造回调
   */
  async handleAlipayNotify(data: any) {
    // 安全修复：先验证签名
    const isValid = await this.alipayService.verifyNotify(data);
    if (!isValid) {
      this.logger.error('[PaymentService] 支付宝签名验证失败');
      return 'fail';
    }

    const outTradeNo = data.out_trade_no;
    const tradeNo = data.trade_no;
    const tradeStatus = data.trade_status;

    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return 'fail';
    }

    const payment = await this.paymentRepository.findOne({
      where: { outTradeNo },
    });

    if (!payment) {
      return 'fail';
    }

    const lockKey = `payment:notify:${payment.paymentNo}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (payment.status === PaymentStatus.SUCCESS) {
        return 'success';
      }

      payment.paymentNo = tradeNo;
      payment.notifyAt = new Date();
      payment.notifyData = data;

      await this.handlePaymentSuccess(payment);

      return 'success';
    });
  }

  /**
   * 验证微信支付回调签名
   * 安全修复：添加签名验证方法
   */
  async verifyWechatNotify(headers: any, body: string): Promise<boolean> {
    return this.wechatPayService.verifyNotify(headers, body);
  }

  /**
   * 微信回调
   * 完善处理：正确解密 resource 字段获取订单信息
   */
  async handleWechatNotify(data: any) {
    // 微信支付回调报文结构：
    // {
    //   "event_type": "TRANSACTION.SUCCESS",
    //   "resource": {
    //     "ciphertext": "...",
    //     "nonce": "...",
    //     "associated_data": "..."
    //   }
    // }

    const eventType = data.event_type;

    // 检查事件类型
    if (eventType !== 'TRANSACTION.SUCCESS') {
      this.logger.log(`[WechatPay] 非支付成功事件: ${eventType}`);
      return { code: 'SUCCESS', message: '已接收' };
    }

    // 解密 resource 字段获取实际订单信息
    let transactionData: any;
    try {
      if (data.resource) {
        transactionData = await this.wechatPayService.decryptNotifyResource(data.resource);
      } else {
        // 兼容直接传入解密后数据的情况
        transactionData = data;
      }
    } catch (error) {
      this.logger.error('[WechatPay] 解密回调数据失败:', error);
      return { code: 'FAIL', message: '解密失败' };
    }

    const outTradeNo = transactionData.out_trade_no;
    const transactionId = transactionData.transaction_id;
    const tradeState = transactionData.trade_state;

    // 检查交易状态
    if (tradeState !== 'SUCCESS') {
      this.logger.log(`[WechatPay] 交易状态非成功: ${tradeState}`);
      return { code: 'SUCCESS', message: '已接收' };
    }

    // 使用 outTradeNo 查找支付记录
    // 注意：微信返回的 out_trade_no 是我们传入的订单号
    // 我们存的是 payment.outTradeNo = orderId，需要通过 paymentNo 或 orderId 查找
    let payment = await this.paymentRepository.findOne({
      where: { paymentNo: outTradeNo },
    });

    // 如果找不到，尝试用 outTradeNo 作为 orderId 查找
    if (!payment) {
      payment = await this.paymentRepository.findOne({
        where: { outTradeNo },
      });
    }

    if (!payment) {
      this.logger.error(`[WechatPay] 找不到支付记录: ${outTradeNo}`);
      return { code: 'FAIL', message: '订单不存在' };
    }

    const lockKey = `payment:notify:${payment.paymentNo}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (payment!.status === PaymentStatus.SUCCESS) {
        return { code: 'SUCCESS', message: '成功' };
      }

      payment!.notifyAt = new Date();
      payment!.notifyData = transactionData;

      await this.handlePaymentSuccess(payment!);

      return { code: 'SUCCESS', message: '成功' };
    });
  }

  /**
   * 查询支付状态
   */
  async getPaymentStatus(paymentNo: string) {
    const payment = await this.paymentRepository.findOne({
      where: { paymentNo },
    });

    if (!payment) {
      throw new BadRequestException('支付记录不存在');
    }

    return {
      status: payment.status,
      paidAt: payment.paidAt,
    };
  }

  /**
   * 微信退款回调处理
   */
  async handleWechatRefundNotify(data: any) {
    // 微信退款回调报文结构：
    // {
    //   "event_type": "REFUND.SUCCESS" 或 "REFUND.ABNORMAL" 或 "REFUND.CLOSED",
    //   "resource": { ... }
    // }

    const eventType = data.event_type;

    // 解密 resource 字段
    let refundData: any;
    try {
      if (data.resource) {
        refundData = await this.wechatPayService.decryptNotifyResource(data.resource);
      } else {
        refundData = data;
      }
    } catch (error) {
      this.logger.error('[WechatPay] 解密退款回调数据失败:', error);
      return { code: 'FAIL', message: '解密失败' };
    }

    const outRefundNo = refundData.out_refund_no;
    const refundStatus = refundData.refund_status;
    const transactionId = refundData.transaction_id;

    this.logger.log(`[WechatPay] 退款回调 - 退款单号: ${outRefundNo}, 状态: ${refundStatus}`);

    // 根据退款状态处理
    switch (refundStatus) {
      case 'SUCCESS':
        // 退款成功
        this.logger.log(`[WechatPay] 退款成功 - 退款单号: ${outRefundNo}`);
        // TODO: 更新本地退款记录状态
        break;
      case 'CLOSED':
        // 退款关闭
        this.logger.warn(`[WechatPay] 退款关闭 - 退款单号: ${outRefundNo}`);
        break;
      case 'ABNORMAL':
        // 退款异常
        this.logger.error(`[WechatPay] 退款异常 - 退款单号: ${outRefundNo}`);
        break;
      default:
        this.logger.log(`[WechatPay] 未知退款状态: ${refundStatus}`);
    }

    return { code: 'SUCCESS', message: '成功' };
  }
}
