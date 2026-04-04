import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RefundOrder, RefundType, RefundStatus, Order, OrderStatus, Adoption, AdoptionStatus } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { IdUtil } from '@/common/utils/id.util';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class RefundService {
  constructor(
    @InjectRepository(RefundOrder)
    private refundRepository: Repository<RefundOrder>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Adoption)
    private adoptionRepository: Repository<Adoption>,
    private dataSource: DataSource,
    private redisService: RedisService,
    private userService: UserService,
    private notificationService: NotificationService,
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
   * 执行退款
   */
  private async executeRefund(refund: RefundOrder, operatorId: string) {
    // 退款到用户余额
    if (refund.refundAmount > 0) {
      await this.userService.updateBalance(
        refund.userId,
        refund.refundAmount,
        `退款: ${refund.refundNo}`,
      );
    }

    // 更新退款状态
    refund.status = RefundStatus.REFUNDED;
    refund.refundMethod = 'balance';
    refund.operatorId = operatorId;
    refund.refundAt = new Date();

    await this.refundRepository.save(refund);

    // 更新原订单状态
    if (refund.orderType === 'adoption') {
      const order = await this.orderRepository.findOne({
        where: { id: refund.orderId },
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

    // 发送通知
    await this.notificationService.sendBalanceNotification(
      refund.userId,
      '退款成功',
      `您的退款申请已处理完成，退款金额¥${refund.refundAmount}已返还至账户余额。`,
    );
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
