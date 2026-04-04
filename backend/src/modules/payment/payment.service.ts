import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentRecord, PaymentStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { OrderService } from '../order/order.service';
import { UserService } from '../user/user.service';
import { AlipayService } from '@/services/alipay.service';
import { WechatPayService } from '@/services/wechat-pay.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentRecord)
    private paymentRepository: Repository<PaymentRecord>,
    private configService: ConfigService,
    private redisService: RedisService,
    private orderService: OrderService,
    private userService: UserService,
    private alipayService: AlipayService,
    private wechatPayService: WechatPayService,
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
      // 检查余额
      const user = await this.userService.findOne(payment.userId);
      if (!user || Number(user.balance) < payment.amount) {
        throw new BadRequestException('余额不足');
      }

      // 扣减余额
      await this.userService.updateBalance(
        payment.userId,
        -payment.amount,
        `支付订单: ${payment.outTradeNo}`,
      );

      // 更新支付状态
      payment.status = PaymentStatus.SUCCESS;
      payment.paidAt = new Date();
      await this.paymentRepository.save(payment);

      // 处理支付成功
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
   */
  async handlePaymentSuccess(payment: PaymentRecord) {
    if (payment.status === PaymentStatus.SUCCESS) {
      return; // 幂等处理
    }

    // 更新支付状态
    payment.status = PaymentStatus.SUCCESS;
    payment.paidAt = new Date();
    await this.paymentRepository.save(payment);

    // 根据订单类型处理
    switch (payment.orderType) {
      case 'adoption':
        await this.orderService.handlePaymentSuccess(
          payment.orderId,
          payment.paymentNo,
          payment.paymentMethod,
        );
        break;
      case 'feed':
        // TODO: 处理饲料费支付
        break;
      case 'redemption':
        // TODO: 处理买断支付
        break;
      case 'recharge':
        // 余额充值
        await this.userService.updateBalance(
          payment.userId,
          payment.amount,
          `余额充值: ${payment.paymentNo}`,
        );
        break;
    }
  }

  /**
   * 支付宝回调
   */
  async handleAlipayNotify(data: any) {
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
   * 微信回调
   */
  async handleWechatNotify(data: any) {
    const outTradeNo = data.out_trade_no;
    const transactionId = data.transaction_id;
    const resultCode = data.result_code;

    if (resultCode !== 'SUCCESS') {
      return { code: 'FAIL', message: '支付失败' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { outTradeNo },
    });

    if (!payment) {
      return { code: 'FAIL', message: '订单不存在' };
    }

    const lockKey = `payment:notify:${payment.paymentNo}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (payment.status === PaymentStatus.SUCCESS) {
        return { code: 'SUCCESS', message: '成功' };
      }

      payment.paymentNo = transactionId;
      payment.notifyAt = new Date();
      payment.notifyData = data;

      await this.handlePaymentSuccess(payment);

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
}
