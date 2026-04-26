import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RefundOrder, RefundStatus, Order, OrderStatus, Adoption } from '@/entities';
import { AlipayService } from '@/services/alipay.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { NotificationService } from '@/modules/notification/notification.service';

interface RefundJobData {
  refundId: string;
  adminId: string;
  adminName: string;
  remark?: string;
}

@Processor(QUEUE_NAMES.REFUND_PROCESS)
export class RefundProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundProcessor.name);

  constructor(
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private readonly adoptionRepository: Repository<Adoption>,
    private readonly dataSource: DataSource,
    private readonly alipayService: AlipayService,
    private readonly wechatPayService: WechatPayService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<RefundJobData>): Promise<any> {
    const { refundId } = job.data;
    this.logger.log(`处理退款作业: ${job.id}, 退款ID: ${refundId}`);

    // 幂等性检查：只有审核通过状态的退款才执行
    const refund = await this.refundOrderRepository.findOne({ where: { id: refundId } });
    if (!refund) {
      this.logger.warn(`退款记录不存在: ${refundId}`);
      return;
    }

    if (refund.status !== RefundStatus.AUDIT_PASSED) {
      this.logger.warn(`退款状态不是审核通过，跳过: ${refundId}, 当前状态: ${refund.status}`);
      return;
    }

    // 分布式锁防止重复执行
    const lockKey = `refund:execute:${refundId}`;
    const locked = await this.redisService.setNX(lockKey, '1', 60);
    if (!locked) {
      this.logger.warn(`退款正在处理中，跳过: ${refundId}`);
      return;
    }

    try {
      await this.executeRefund(refund, job.data);
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  private async executeRefund(refund: RefundOrder, jobData: RefundJobData) {
    // 查找原支付记录
    const paymentRecord = await this.dataSource.getRepository('PaymentRecord' as any).findOne({
      where: { orderType: refund.orderType, orderId: refund.orderId },
      order: { createdAt: 'DESC' },
    });

    let refundMethod = 'balance';
    let refundMessage = '已退回到账户余额';

    // 尝试原路退款
    if (paymentRecord?.paymentMethod && paymentRecord.paymentNo) {
      const paymentMethod = paymentRecord.paymentMethod;
      const totalAmount = Number(paymentRecord.amount);
      const refundAmount = Number(refund.refundAmount);

      if (paymentMethod === 'wechat') {
        try {
          const result = await this.wechatPayService.refund(
            paymentRecord.paymentNo,
            totalAmount,
            refundAmount,
            refund.reason || '系统自动退款',
          );
          if (result.success) {
            refundMethod = 'wechat';
            refundMessage = '已退回到微信支付账户';
          } else {
            refundMessage = `微信退款失败(${result.message})，已退回到账户余额`;
          }
        } catch {
          refundMessage = '微信退款异常，已退回到账户余额';
        }
      } else if (paymentMethod === 'alipay') {
        try {
          const result = await this.alipayService.refund(
            paymentRecord.paymentNo,
            refundAmount,
            refund.reason || '系统自动退款',
          );
          if (result.success) {
            refundMethod = 'alipay';
            refundMessage = '已退回到支付宝账户';
          } else {
            refundMessage = `支付宝退款失败(${result.message})，已退回到账户余额`;
          }
        } catch {
          refundMessage = '支付宝退款异常，已退回到账户余额';
        }
      }
    }

    // 使用事务处理数据库操作
    await this.dataSource.transaction(async (manager) => {
      // 如果原路退款失败或余额支付，退回到用户余额
      if (refundMethod === 'balance' && refund.refundAmount > 0) {
        const user = await manager.findOne('User' as any, {
          where: { id: refund.userId },
          lock: { mode: 'pessimistic_write' },
        }) as any;

        if (user) {
          const beforeBalance = Number(user.balance) || 0;
          const refundAmountNum = Number(refund.refundAmount);
          const afterBalance = Math.round((beforeBalance + refundAmountNum) * 100) / 100;
          user.balance = afterBalance;
          await manager.save(user);

          const balanceLog = manager.create('BalanceLog' as any, {
            id: IdUtil.generate('BL'),
            userId: refund.userId,
            type: 3,
            amount: refundAmountNum,
            balanceBefore: beforeBalance,
            balanceAfter: afterBalance,
            relatedType: 'refund',
            relatedId: refund.id,
            remark: `退款: ${refund.refundNo}`,
          });
          await manager.save(balanceLog);
        }
      }

      // 更新退款状态
      refund.status = RefundStatus.REFUNDED;
      refund.refundMethod = refundMethod;
      refund.operatorId = jobData.adminId;
      refund.refundAt = new Date();
      await manager.save(RefundOrder, refund);

      // 更新原订单状态
      if (refund.orderType === 'adoption') {
        const order = await manager.findOne(Order, { where: { id: refund.orderId } });
        if (order) {
          order.status = OrderStatus.REFUNDED;
          await manager.save(Order, order);
        }
      }
    });

    // 发送退款成功通知
    await this.notificationService.sendBalanceNotification(
      refund.userId,
      '退款成功',
      `您的退款申请已处理完成，退款金额¥${refund.refundAmount}${refundMessage}。`,
    ).catch(err => this.logger.error('发送退款通知失败:', err));

    this.logger.log(`退款执行完成: ${refund.refundNo}, 方式: ${refundMethod}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`退款作业失败: ${job.id} (attempts: ${job.attemptsMade}) - ${err.message}`);
  }
}
