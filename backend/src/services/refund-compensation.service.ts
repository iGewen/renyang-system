import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundOrder, RefundStatus, Order, OrderStatus } from '@/entities';
import { AlipayService } from './alipay.service';
import { WechatPayService } from './wechat-pay.service';
import { IdUtil } from '@/common/utils/id.util';

/**
 * 退款状态补偿服务
 * 处理退款异常情况，保证最终一致性
 */
@Injectable()
export class RefundCompensationService {
  private readonly logger = new Logger(RefundCompensationService.name);

  // 退款处理超时阈值：1小时（毫秒）
  private readonly REFUND_TIMEOUT_MS = 60 * 60 * 1000;

  // 最大重试次数
  private readonly MAX_RETRY_COUNT = 5;

  constructor(
    @InjectRepository(RefundOrder)
    private readonly refundOrderRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly alipayService: AlipayService,
    private readonly wechatPayService: WechatPayService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 扫描并补偿超时的退款订单
   * 每小时执行一次
   */
  async compensateTimeoutRefunds(): Promise<{ processed: number; success: number; failed: number }> {
    this.logger.log('开始扫描超时退款订单...');

    const timeoutDate = new Date(Date.now() - this.REFUND_TIMEOUT_MS);

    // 查找超过1小时仍处于 AUDIT_PASSED 状态的退款订单
    // 这些是已审核通过但可能未实际执行退款的订单
    const timeoutRefunds = await this.refundOrderRepository.find({
      where: {
        status: RefundStatus.AUDIT_PASSED,
        auditAt: LessThan(timeoutDate),
      },
      take: 100, // 每次最多处理100条
    });

    if (timeoutRefunds.length === 0) {
      this.logger.log('没有超时的退款订单');
      return { processed: 0, success: 0, failed: 0 };
    }

    this.logger.log(`发现 ${timeoutRefunds.length} 条超时退款订单`);

    let success = 0;
    let failed = 0;

    for (const refund of timeoutRefunds) {
      try {
        const result = await this.compensateRefund(refund);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        this.logger.error(`补偿退款失败: ${refund.id}`, error);
        failed++;
      }
    }

    this.logger.log(`退款补偿完成: 处理 ${timeoutRefunds.length}, 成功 ${success}, 失败 ${failed}`);
    return { processed: timeoutRefunds.length, success, failed };
  }

  /**
   * 补偿单个退款订单
   * 尝试查询网关状态，如果确认已退款则更新本地状态
   * 如果网关无记录或查询失败，执行降级退款（退余额）
   */
  private async compensateRefund(refund: RefundOrder): Promise<boolean> {
    this.logger.log(`补偿退款: ${refund.id} (${refund.refundNo})`);

    // 查找原支付记录
    const paymentRecord = await this.dataSource.getRepository('PaymentRecord' as any).findOne({
      where: { orderType: refund.orderType, orderId: refund.orderId },
      order: { createdAt: 'DESC' },
    });

    let gatewayConfirmed = false;
    let gatewayRefundSuccess = false;

    // 尝试查询网关退款状态
    if (paymentRecord?.paymentMethod && paymentRecord.paymentNo) {
      if (paymentRecord.paymentMethod === 'alipay') {
        try {
          // 支付宝退款查询
          const result = await this.alipayService.queryRefund(refund.refundNo);
          if (result.success) {
            gatewayConfirmed = true;
            gatewayRefundSuccess = result.refundStatus === 'SUCCESS';
          }
        } catch {
          this.logger.warn(`支付宝退款查询失败: ${refund.refundNo}`);
        }
      } else if (paymentRecord.paymentMethod === 'wechat') {
        try {
          // 微信退款查询
          const result = await this.wechatPayService.queryRefund(refund.refundNo);
          if (result.success) {
            gatewayConfirmed = true;
            gatewayRefundSuccess = result.refundStatus === 'SUCCESS';
          }
        } catch {
          this.logger.warn(`微信退款查询失败: ${refund.refundNo}`);
        }
      }
    }

    if (gatewayConfirmed && gatewayRefundSuccess) {
      // 网关确认已退款，更新本地状态
      await this.updateRefundSuccess(refund, paymentRecord?.paymentMethod || 'unknown');
      this.logger.log(`网关确认退款成功，已更新状态: ${refund.refundNo}`);
      return true;
    }

    // 网关未确认或查询失败，执行降级退款（退余额）
    this.logger.warn(`网关未确认退款，执行降级退余额: ${refund.refundNo}`);
    return await this.fallbackToBalance(refund);
  }

  /**
   * 更新退款成功状态
   */
  private async updateRefundSuccess(refund: RefundOrder, refundMethod: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      refund.status = RefundStatus.REFUNDED;
      refund.refundMethod = refundMethod;
      refund.refundAt = new Date();
      await manager.save(RefundOrder, refund);

      // 更新订单状态
      if (refund.orderType === 'adoption') {
        const order = await manager.findOne(Order, { where: { id: refund.orderId } });
        if (order && order.status !== OrderStatus.REFUNDED) {
          order.status = OrderStatus.REFUNDED;
          await manager.save(Order, order);
        }
      }
    });

    // 发出退款完成事件
    this.eventEmitter.emit('order.refund.completed', {
      orderId: refund.orderId,
      refundId: refund.id,
      refundMethod,
      refundAmount: Number(refund.refundAmount),
    });
  }

  /**
   * 降级退款：退到用户余额
   */
  private async fallbackToBalance(refund: RefundOrder): Promise<boolean> {
    try {
      await this.dataSource.transaction(async (manager) => {
        // 查询用户
        const user = await manager.findOne('User' as any, {
          where: { id: refund.userId },
          lock: { mode: 'pessimistic_write' },
        }) as any;

        if (!user) {
          throw new Error(`用户不存在: ${refund.userId}`);
        }

        const beforeBalance = Number(user.balance) || 0;
        const refundAmount = Number(refund.refundAmount);
        const afterBalance = Math.round((beforeBalance + refundAmount) * 100) / 100;
        user.balance = afterBalance;
        await manager.save(user);

        // 记录余额日志
        const balanceLog = manager.create('BalanceLog' as any, {
          id: IdUtil.generate('BL'),
          userId: refund.userId,
          type: 3,
          amount: refundAmount,
          balanceBefore: beforeBalance,
          balanceAfter: afterBalance,
          relatedType: 'refund_compensation',
          relatedId: refund.id,
          remark: `退款补偿(降级): ${refund.refundNo}`,
        });
        await manager.save(balanceLog);

        // 更新退款状态
        refund.status = RefundStatus.REFUNDED;
        refund.refundMethod = 'balance';
        refund.refundAt = new Date();
        await manager.save(RefundOrder, refund);

        // 更新订单状态
        if (refund.orderType === 'adoption') {
          const order = await manager.findOne(Order, { where: { id: refund.orderId } });
          if (order && order.status !== OrderStatus.REFUNDED) {
            order.status = OrderStatus.REFUNDED;
            await manager.save(Order, order);
          }
        }
      });

      // 发出退款完成事件
      this.eventEmitter.emit('order.refund.completed', {
        orderId: refund.orderId,
        refundId: refund.id,
        refundMethod: 'balance',
        refundAmount: Number(refund.refundAmount),
      });

      this.logger.log(`降级退余额成功: ${refund.refundNo}`);
      return true;
    } catch (error) {
      this.logger.error(`降级退余额失败: ${refund.refundNo}`, error);
      return false;
    }
  }

  /**
   * 记录退款失败告警
   * 当退款作业重试次数超过阈值时调用
   */
  async logRefundFailureAlert(refundId: string, retryCount: number, reason: string): Promise<void> {
    this.logger.error(`[退款告警] 退款失败超过阈值 - 退款ID: ${refundId}, 重试次数: ${retryCount}, 原因: ${reason}`);

    // 发出退款失败事件
    this.eventEmitter.emit('order.refund.failed', {
      orderId: '',
      refundId,
      reason,
      retryCount,
    });
  }

  /**
   * 检查订单状态异常
   * 扫描长时间处于非终态的订单
   */
  async checkAbnormalOrders(): Promise<{ count: number }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 查找超过24小时仍处于 REFUND_PROCESSING 状态的订单
    const abnormalOrders = await this.orderRepository.count({
      where: {
        status: OrderStatus.REFUND_PROCESSING,
        updatedAt: LessThan(oneDayAgo),
      },
    });

    if (abnormalOrders > 0) {
      this.logger.warn(`[订单告警] 发现 ${abnormalOrders} 个长时间处于退款处理中状态的订单`);
    }

    return { count: abnormalOrders };
  }
}
