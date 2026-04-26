import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@/entities';
import { AdminService } from '../admin.service';
import { IdUtil } from '@/common/utils/id.util';
import { normalizePagination } from '@/common/utils/pagination.util';

@Injectable()
export class AdminNotificationService {
  private readonly logger = new Logger(AdminNotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly adminService: AdminService,
  ) {}

  /**
   * 获取通知列表
   */
  async getNotificationList(params: {
    page: number;
    pageSize: number;
    type?: string;
  }) {
    const { page, pageSize, skip } = normalizePagination(params.page, params.pageSize);
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification');

    if (params.type) {
      queryBuilder.andWhere('notification.type = :type', { type: params.type });
    }

    queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
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
   * 发送通知
   */
  async sendNotification(
    data: { userIds?: string[]; title: string; content: string; type: string },
    adminId: string,
    adminName: string,
    ip?: string,
  ) {
    let sendCount = 0;

    if (data.userIds && data.userIds.length > 0) {
      for (const userId of data.userIds) {
        const notification = this.notificationRepository.create({
          id: IdUtil.generate('N'),
          userId,
          title: data.title,
          content: data.content,
          type: data.type,
        });
        await this.notificationRepository.save(notification);
        sendCount++;
      }
    } else {
      const notification = this.notificationRepository.create({
        id: IdUtil.generate('N'),
        userId: null,
        title: data.title,
        content: data.content,
        type: data.type,
      });
      await this.notificationRepository.save(notification);
      sendCount = 1;
    }

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'notification',
      action: 'send',
      targetType: 'notification',
      afterData: { title: data.title, content: data.content, type: data.type, sendCount },
      remark: `发送通知: ${data.title}`,
      ip,
    });

    return { success: true, sendCount };
  }

  /**
   * 发送系统公告
   */
  async sendSystemAnnouncement(title: string, content: string, adminId: string, adminName: string, ip?: string) {
    const notification = this.notificationRepository.create({
      id: IdUtil.generate('N'),
      title,
      content,
      type: 'system',
    });

    await this.notificationRepository.save(notification);

    await this.adminService.createAuditLog({
      adminId,
      adminName,
      module: 'notification',
      action: 'send_announcement',
      targetType: 'notification',
      targetId: notification.id,
      afterData: { title, content },
      remark: '发送系统公告',
      ip,
    });

    return notification;
  }
}
