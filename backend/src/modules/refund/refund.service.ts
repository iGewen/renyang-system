import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RefundOrder, RefundType, RefundStatus, Order, OrderStatus, Adoption, AdoptionStatus, PaymentRecord, AuditLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { WechatPayService } from '@/services/wechat-pay.service';
import { AlipayService } from '@/services/alipay.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(RefundOrder)
    private refundRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    @InjectRepository(PaymentRecord)
    private paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
    private redisService: RedisService,
    private userService: UserService,
    private notificationService: NotificationService,
    private wechatPayService: WechatPayService,
    private alipayService: AlipayService,
  ) {}

  /**
   * 用户申请退款
   */
  async applyRefund(
    userId: string,
    orderType: string,
    orderId: string,
    reason: string,
  ) {
    // 验证订单
    let order: Order | null = null;
    let adoption: Adoption | null = null;
    let refundLivestock = 2; // 默认不退活体
    let originalAmount = 0;

    if (orderType === 'adoption') {
      order = await this.orderRepository.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException('订单状态不允许退款');
      }

      originalAmount = Number(order.totalAmount);

      // 查找领养记录
      adoption = await this.adoptionRepository.findOne({
        where: { orderId: order.id },
      });

      if (adoption && adoption.status !== AdoptionStatus.ACTIVE) {
        throw new BadRequestException('领养状态不允许退款');
      }

      // 领养订单需要退活体
      refundLivestock = 1;
    } else if (orderType === 'feed') {
      // 饲料费退款逻辑
      throw new BadRequestException('饲料费退款请联系客服处理');
    } else if (orderType === 'redemption') {
      throw new BadRequestException('买断订单不支持退款');
    } else {
      throw new BadRequestException('不支持的订单类型');
    }

    // 检查是否已有待审核的退款申请
    const existingRefund = await this.refundRepository.findOne({
      where: {
        orderType,
        orderId,
        status: RefundStatus.PENDING_AUDIT,
      },
    });

    if (existingRefund) {
      throw new BadRequestException('已有待审核的退款申请');
    }

    // 创建退款订单
    const refund = this.refundRepository.create({
      id: IdUtil.generate('RFD'),
      refundNo: IdUtil.generateRefundNo(),
      userId,
      orderType,
      orderId,
      originalAmount,
      refundAmount: originalAmount, // 默认全额退款
      refundLivestock,
      reason,
      type: RefundType.USER_APPLY,
      status: RefundStatus.PENDING_AUDIT,
    });

    await this.refundRepository.save(refund);

    return refund;
  }

  /**
   * 获取退款详情
   */
  async getRefundDetail(refundId: string, userId?: string) {
    const where: any = { id: refundId };
    if (userId) {
      where.userId = userId;
    }

    const refund = await this.refundRepository.findOne({
      where,
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    return refund;
  }

  /**
   * 获取用户的退款列表
   */
  async getMyRefunds(userId: string, status?: RefundStatus) {
    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .where('refund.userId = :userId', { userId });

    if (status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status });
    }

    queryBuilder.orderBy('refund.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * 取消退款申请
   */
  async cancelRefund(refundId: string, userId: string) {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId, userId },
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许取消');
    }

    refund.status = RefundStatus.CANCELLED;
    await this.refundRepository.save(refund);

    return { success: true };
  }

  /**
   * 审核退款申请（管理员）
   * 需要二次确认
   */
  async auditRefund(
    refundId: string,
    adminId: string,
    passed: boolean,
    refundAmount: number,
    remark: string,
    confirmToken?: string,
  ) {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId },
      relations: ['user'],
    });

    if (!refund) {
      throw new NotFoundException('退款记录不存在');
    }

    if (refund.status !== RefundStatus.PENDING_AUDIT) {
      throw new BadRequestException('当前状态不允许审核');
    }

    // 第一次审核，生成确认token
    if (!confirmToken) {
      const token = `refund:confirm:${refundId}:${Date.now()}`;
      await this.redisService.set(token, adminId, 300); // 5分钟有效

      return {
        needConfirm: true,
        confirmToken: token,
        message: '请再次确认退款操作',
      };
    }

    // 验证确认token
    const storedAdminId = await this.redisService.get(confirmToken);
    if (!storedAdminId || storedAdminId !== adminId) {
      throw new BadRequestException('确认token无效或已过期');
    }

    const lockKey = `refund:audit:${refundId}`;
    return this.redisService.withLock(lockKey, 30000, async () => {
      if (passed) {
        // 审核通过
        refund.status = RefundStatus.AUDIT_PASSED;
        refund.auditAdminId = adminId;
        refund.auditAt = new Date();
        refund.auditRemark = remark;
        refund.refundAmount = refundAmount;

        await this.refundRepository.save(refund);

        // 执行退款
        await this.executeRefund(refund, adminId);
      } else {
        // 审核拒绝
        refund.status = RefundStatus.AUDIT_REJECTED;
        refund.auditAdminId = adminId;
        refund.auditAt = new Date();
        refund.auditRemark = remark;

        await this.refundRepository.save(refund);
      }

      // 删除确认token
      await this.redisService.del(confirmToken);

      return refund;
    });
  }

  /**
   * 执行退款 - 原路退回
   * 根据支付方式选择退款渠道：
   * - 微信支付 → 退回到微信
   * - 支付宝支付 → 退回到支付宝
   * - 余额支付 → 退回到余额
   */
  private async executeRefund(refund: RefundOrder, operatorId: string) {
    // 使用事务确保数据一致性
    return this.dataSource.transaction(async (manager) => {
      // 获取原支付记录
      const paymentRecord = await manager.findOne(PaymentRecord, {
        where: {
          orderType: refund.orderType,
          orderId: refund.orderId,
        },
        order: { createdAt: 'DESC' },
      });

      let refundMethod = 'balance';
      let refundSuccess = true;
      let refundMessage = '';

      if (paymentRecord && paymentRecord.paymentMethod && paymentRecord.paymentNo) {
        const paymentMethod = paymentRecord.paymentMethod;
        const totalAmount = Number(paymentRecord.amount);
        const refundAmount = Number(refund.refundAmount);

        if (paymentMethod === 'wechat') {
          // 微信支付退款
          this.logger.log(`[Refund] 微信支付退款 - 订单号: ${paymentRecord.paymentNo}, 金额: ${refundAmount}`);
          try {
            const result = await this.wechatPayService.refund(
              paymentRecord.paymentNo,
              totalAmount,
              refundAmount,
              refund.reason || '用户申请退款',
            );
            if (result.success) {
              refundMethod = 'wechat';
              refundMessage = '已退回到微信支付账户';
              this.logger.log(`[Refund] 微信退款成功 - 退款单号: ${result.refundId}`);
            } else {
              // 微信退款失败，退回到余额
              this.logger.error(`[Refund] 微信退款失败: ${result.message}, 改为退回到余额`);
              refundMessage = `微信退款失败(${result.message})，已退回到账户余额`;
            }
          } catch (error) {
            this.logger.error(`[Refund] 微信退款异常: ${error.message}, 改为退回到余额`);
            refundMessage = `微信退款异常，已退回到账户余额`;
          }
        } else if (paymentMethod === 'alipay') {
          // 支付宝退款
          this.logger.log(`[Refund] 支付宝退款 - 订单号: ${paymentRecord.paymentNo}, 金额: ${refundAmount}`);
          try {
            const result = await this.alipayService.refund(
              paymentRecord.paymentNo,
              refundAmount,
              refund.reason || '用户申请退款',
            );
            if (result.success) {
              refundMethod = 'alipay';
              refundMessage = '已退回到支付宝账户';
              this.logger.log(`[Refund] 支付宝退款成功 - 退款单号: ${result.refundNo}`);
            } else {
              // 支付宝退款失败，退回到余额
              this.logger.error(`[Refund] 支付宝退款失败: ${result.message}, 改为退回到余额`);
              refundMessage = `支付宝退款失败(${result.message})，已退回到账户余额`;
            }
          } catch (error) {
            this.logger.error(`[Refund] 支付宝退款异常: ${error.message}, 改为退回到余额`);
            refundMessage = `支付宝退款异常，已退回到账户余额`;
          }
        } else if (paymentMethod === 'balance') {
          // 余额支付，直接退回到余额
          refundMethod = 'balance';
          refundMessage = '已退回到账户余额';
        }
      }

      // 如果原路退款失败或余额支付，退回到用户余额
      if (refundMethod === 'balance' && refund.refundAmount > 0) {
        // 在事务内更新余额
        const user = await manager.findOne('User' as any, { where: { id: refund.userId } }) as any;
        if (user) {
          user.balance = Number(user.balance) + Number(refund.refundAmount);
          await manager.save(user);
        }
      }

      // 更新退款状态
      refund.status = RefundStatus.REFUNDED;
      refund.refundMethod = refundMethod;
      refund.operatorId = operatorId;
      refund.refundAt = new Date();

      await manager.save(RefundOrder, refund);

      // 更新原订单状态
      if (refund.orderType === 'adoption') {
        const order = await manager.findOne(Order, {
          where: { id: refund.orderId },
        });

        if (order) {
          order.status = OrderStatus.REFUNDED;
          await manager.save(Order, order);

          // 更新领养状态
          const adoption = await manager.findOne(Adoption, {
            where: { orderId: order.id },
          });

          if (adoption) {
            adoption.status = AdoptionStatus.TERMINATED;
            await manager.save(Adoption, adoption);
          }
        }
      }

      // 发送通知（在事务外执行，不影响事务）
      this.notificationService.sendBalanceNotification(
        refund.userId,
        '退款成功',
        `您的退款申请已处理完成，退款金额¥${refund.refundAmount}${refundMessage}。`,
      ).catch(err => this.logger.error('发送退款通知失败:', err));
    });
  }

  /**
   * 管理员直接退款
   */
  async adminRefund(
    adminId: string,
    userId: string,
    amount: number,
    reason: string,
    orderType?: string,
    orderId?: string,
    adminName?: string,
    ip?: string,
  ) {
    const refund = this.refundRepository.create({
      id: IdUtil.generate('RFD'),
      refundNo: IdUtil.generateRefundNo(),
      userId,
      orderType: orderType || 'admin',
      orderId: orderId || '',
      originalAmount: amount,
      refundAmount: amount,
      refundLivestock: 2, // 管理员操作不涉及活体
      reason,
      type: RefundType.ADMIN_OPERATE,
      status: RefundStatus.REFUNDED,
      auditAdminId: adminId,
      auditAt: new Date(),
      operatorId: adminId,
      refundMethod: 'balance',
      refundAt: new Date(),
    });

    await this.refundRepository.save(refund);

    // 退款到用户余额
    await this.userService.updateBalance(
      userId,
      amount,
      `管理员退款: ${refund.refundNo}`,
    );

    // 更新订单状态
    if (orderType === 'adoption' && orderId) {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (order) {
        order.status = OrderStatus.REFUNDED;
        await this.orderRepository.save(order);

        // 更新领养状态
        const adoption = await this.adoptionRepository.findOne({
          where: { orderId: order.id },
        });

        if (adoption) {
          adoption.status = AdoptionStatus.TERMINATED;
          await this.adoptionRepository.save(adoption);
        }
      }
    }

    // 记录审计日志
    const auditLog = this.auditLogRepository.create({
      adminId,
      adminName: adminName || 'admin',
      module: 'refund',
      action: 'refund',
      targetType: orderType || 'admin',
      targetId: orderId || refund.id,
      afterData: {
        refundNo: refund.refundNo,
        userId,
        amount,
        reason,
        orderType,
        orderId,
      },
      remark: `管理员退款: ¥${amount}, 原因: ${reason}`,
      ip,
    });
    await this.auditLogRepository.save(auditLog);

    // 发送通知
    await this.notificationService.sendBalanceNotification(
      userId,
      '退款通知',
      `您已收到一笔退款¥${amount}，原因：${reason}`,
    );

    return refund;
  }

  /**
   * 获取待审核退款列表（管理员）
   */
  async getPendingRefunds(page: number = 1, pageSize: number = 10) {
    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user')
      .where('refund.status = :status', { status: RefundStatus.PENDING_AUDIT })
      .orderBy('refund.createdAt', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取所有退款列表（管理员）
   */
  async getAllRefunds(page: number = 1, pageSize: number = 10, status?: RefundStatus) {
    const queryBuilder = this.refundRepository.createQueryBuilder('refund')
      .leftJoinAndSelect('refund.user', 'user');

    if (status !== undefined) {
      queryBuilder.andWhere('refund.status = :status', { status });
    }

    queryBuilder
      .orderBy('refund.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
