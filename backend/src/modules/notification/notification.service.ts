import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, User } from '@/entities';
import { WechatService } from '@/services/wechat.service';
import { IdUtil } from '@/common/utils/id.util';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly wechatService: WechatService,
  ) {}

  /**
   * 创建通知
   */
  async createNotification(params: {
    userId?: string | null;
    title: string;
    content: string;
    type: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    const notification = this.notificationRepository.create({
      id: IdUtil.generate('N'),
      ...params,
      isRead: 0,
    });

    return this.notificationRepository.save(notification);
  }

  /**
   * 创建系统公告（全员通知）
   */
  async createSystemAnnouncement(title: string, content: string) {
    return this.createNotification({
      title,
      content,
      type: 'system',
    });
  }

  /**
   * 发送订单通知
   */
  async sendOrderNotification(userId: string, title: string, content: string, orderId: string) {
    return this.createNotification({
      userId,
      title,
      content,
      type: 'order',
      relatedType: 'order',
      relatedId: orderId,
    });
  }

  /**
   * 发送饲料费通知
   */
  async sendFeedNotification(userId: string, title: string, content: string, billId: string) {
    return this.createNotification({
      userId,
      title,
      content,
      type: 'feed',
      relatedType: 'feedBill',
      relatedId: billId,
    });
  }

  /**
   * 发送买断通知
   */
  async sendRedemptionNotification(userId: string, title: string, content: string, redemptionId: string) {
    return this.createNotification({
      userId,
      title,
      content,
      type: 'redemption',
      relatedType: 'redemption',
      relatedId: redemptionId,
    });
  }

  /**
   * 发送余额变动通知
   */
  async sendBalanceNotification(userId: string, title: string, content: string) {
    return this.createNotification({
      userId,
      title,
      content,
      type: 'balance',
    });
  }

  /**
   * 获取用户通知列表
   */
  async getUserNotifications(userId: string, page: number = 1, pageSize: number = 20, isRead?: number) {
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .where('notification.userId = :userId OR notification.userId IS NULL', { userId });

    // 如果指定了 isRead 参数，添加筛选条件
    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    queryBuilder
      .orderBy('notification.createdAt', 'DESC')
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
   * 获取未读数量
   */
  async getUnreadCount(userId: string) {
    const count = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('(notification.userId = :userId OR notification.userId IS NULL)', { userId })
      .andWhere('notification.isRead = 0')
      .getCount();

    return {
      unreadCount: count,
      totalCount: count,
    };
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('通知不存在');
    }

    // 验证权限
    if (notification.userId && notification.userId !== userId) {
      throw new Error('无权操作此通知');
    }

    notification.isRead = 1;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string) {
    // 只标记用户专属通知为已读，不标记系统公告（系统公告是共享的）
    await this.notificationRepository.update(
      { userId, isRead: 0 },
      { isRead: 1, readAt: new Date() },
    );

    return { success: true };
  }

  /**
   * 删除通知
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('通知不存在');
    }

    // 验证权限
    if (notification.userId && notification.userId !== userId) {
      throw new Error('无权删除此通知');
    }

    return this.notificationRepository.remove(notification);
  }

  /**
   * 清空已读通知
   */
  async clearReadNotifications(userId: string) {
    await this.notificationRepository.delete({
      userId,
      isRead: 1,
    });

    return { success: true };
  }

  // ==================== 微信模板消息通知 ====================

  /**
   * 获取用户的微信openid
   */
  private async getUserWechatOpenId(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['wechatOpenId'],
    });
    return user?.wechatOpenId || null;
  }

  /**
   * 发送领养成功通知（站内信 + 微信）
   */
  async sendAdoptionSuccess(params: {
    userId: string;
    orderNo: string;
    livestockName: string;
    amount: number;
    orderId: string;
  }) {
    // 发送站内信
    await this.sendOrderNotification(
      params.userId,
      '领养成功',
      `您已成功领养「${params.livestockName}」，订单金额¥${params.amount.toFixed(2)}。感谢您的信任！`,
      params.orderId,
    );

    // 发送微信通知
    const openid = await this.getUserWechatOpenId(params.userId);
    if (openid) {
      await this.wechatService.sendAdoptionSuccessNotice({
        openid,
        orderNo: params.orderNo,
        livestockName: params.livestockName,
        amount: params.amount,
        time: new Date().toLocaleString('zh-CN'),
      });
    }
  }

  /**
   * 发送饲料费账单通知（站内信 + 微信）
   */
  async sendFeedBillCreated(params: {
    userId: string;
    billId: string;
    billMonth: string;
    livestockName: string;
    amount: number;
    deadline: string;
  }) {
    // 发送站内信
    await this.sendFeedNotification(
      params.userId,
      '饲料费账单',
      `您的${params.billMonth}月饲料费账单已生成，金额¥${params.amount.toFixed(2)}，请于${params.deadline}前缴纳。`,
      params.billId,
    );

    // 发送微信通知
    const openid = await this.getUserWechatOpenId(params.userId);
    if (openid) {
      await this.wechatService.sendFeedBillNotice({
        openid,
        billMonth: params.billMonth,
        livestockName: params.livestockName,
        amount: params.amount,
        deadline: params.deadline,
      });
    }
  }

  /**
   * 发送饲料费逾期提醒（站内信 + 微信）
   */
  async sendFeedBillOverdue(params: {
    userId: string;
    billId: string;
    billMonth: string;
    livestockName: string;
    amount: number;
    overdueDays: number;
    lateFee: number;
  }) {
    // 发送站内信
    await this.sendFeedNotification(
      params.userId,
      '饲料费逾期提醒',
      `您的${params.billMonth}月饲料费已逾期${params.overdueDays}天，滞纳金¥${params.lateFee.toFixed(2)}，请尽快缴纳！`,
      params.billId,
    );

    // 发送微信通知
    const openid = await this.getUserWechatOpenId(params.userId);
    if (openid) {
      await this.wechatService.sendFeedBillOverdueNotice({
        openid,
        billMonth: params.billMonth,
        livestockName: params.livestockName,
        amount: params.amount,
        overdueDays: params.overdueDays,
        lateFee: params.lateFee,
      });
    }
  }

  /**
   * 发送买断审核结果通知（站内信 + 微信）
   */
  async sendRedemptionAuditResult(params: {
    userId: string;
    redemptionId: string;
    redemptionNo: string;
    livestockName: string;
    approved: boolean;
    amount?: number;
    remark?: string;
  }) {
    // 发送站内信
    // 构建通知内容
    const approvedContent = `您的买断申请（${params.livestockName}）已通过审核，金额¥${params.amount?.toFixed(2) || '-'}，请尽快完成支付。`;
    const remarkText = params.remark ? `原因：${params.remark}` : '';
    const rejectedContent = `您的买断申请（${params.livestockName}）未通过审核。${remarkText}`;

    await this.sendRedemptionNotification(
      params.userId,
      params.approved ? '买断申请已通过' : '买断申请已拒绝',
      params.approved ? approvedContent : rejectedContent,
      params.redemptionId,
    );

    // 发送微信通知
    const openid = await this.getUserWechatOpenId(params.userId);
    if (openid) {
      await this.wechatService.sendRedemptionAuditNotice({
        openid,
        redemptionNo: params.redemptionNo,
        livestockName: params.livestockName,
        approved: params.approved,
        amount: params.amount,
        remark: params.remark,
      });
    }
  }

  /**
   * 发送买断成功通知（站内信 + 微信）
   */
  async sendRedemptionSuccess(params: {
    userId: string;
    redemptionId: string;
    redemptionNo: string;
    livestockName: string;
    amount: number;
  }) {
    // 发送站内信
    await this.sendRedemptionNotification(
      params.userId,
      '买断成功',
      `恭喜您成功买断「${params.livestockName}」，金额¥${params.amount.toFixed(2)}。感谢您的支持！`,
      params.redemptionId,
    );

    // 发送微信通知
    const openid = await this.getUserWechatOpenId(params.userId);
    if (openid) {
      await this.wechatService.sendRedemptionSuccessNotice({
        openid,
        redemptionNo: params.redemptionNo,
        livestockName: params.livestockName,
        amount: params.amount,
        time: new Date().toLocaleString('zh-CN'),
      });
    }
  }
}
