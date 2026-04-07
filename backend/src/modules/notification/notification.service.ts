import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@/entities';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  /**
   * 创建通知
   */
  async createNotification(params: {
    userId?: string;
    title: string;
    content: string;
    type: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    const notification = this.notificationRepository.create({
      id: `N${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
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
  async getUserNotifications(userId: string, page: number = 1, pageSize: number = 20) {
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .where('notification.userId = :userId OR notification.userId IS NULL', { userId })
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
    // 获取用户专属的未读通知数量
    const userUnreadCount = await this.notificationRepository.count({
      where: { userId, isRead: 0 },
    });

    // 获取系统公告（userId为null）- 暂时全部视为未读
    // TODO: 可以建立用户已读记录表来跟踪系统公告的已读状态
    const systemAnnouncementCount = await this.notificationRepository.count({
      where: { userId: null as any, isRead: 0 },
    });

    // 总未读数 = 用户专属未读 + 系统公告未读
    const totalCount = userUnreadCount + systemAnnouncementCount;

    return {
      unreadCount: totalCount,
      totalCount,
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
    // 标记用户专属通知为已读
    await this.notificationRepository.update(
      { userId, isRead: 0 },
      { isRead: 1, readAt: new Date() },
    );

    // 标记系统公告为已读（userId为null的通知）
    await this.notificationRepository.update(
      { userId: null as any, isRead: 0 },
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
}
