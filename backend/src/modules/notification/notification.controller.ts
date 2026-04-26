import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 获取通知列表
   */
  @Get()
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isRead') isRead?: string,
  ) {
    return this.notificationService.getUserNotifications(
      userId,
      page ? Number.parseInt(page) : 1,
      pageSize ? Number.parseInt(pageSize) : 20,
      isRead !== undefined ? Number.parseInt(isRead) : undefined,
    );
  }

  /**
   * 获取未读数量
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  /**
   * 标记通知为已读
   */
  @Post(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationService.markAsRead(notificationId, userId);
  }

  /**
   * 标记所有通知为已读
   */
  @Post('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  /**
   * 删除通知
   */
  @Post(':id/delete')
  async deleteNotification(
    @Param('id') notificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationService.deleteNotification(notificationId, userId);
  }

  /**
   * 清空已读通知
   */
  @Post('clear-read')
  async clearReadNotifications(@CurrentUser('id') userId: string) {
    return this.notificationService.clearReadNotifications(userId);
  }
}
