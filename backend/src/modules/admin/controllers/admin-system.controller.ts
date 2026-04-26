import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import {
  AdminConfigBasicService,
  AdminNotificationService,
  AdminAgreementService,
  AdminExportService,
} from '../services';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { UpdateSystemConfigDto, SendAnnouncementDto, SaveAgreementDto, SendNotificationDto } from '../dto';

@ApiTags('管理员 - 系统管理')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminSystemController {
  constructor(
    private readonly adminConfigBasicService: AdminConfigBasicService,
    private readonly adminNotificationService: AdminNotificationService,
    private readonly adminAgreementService: AdminAgreementService,
    private readonly adminExportService: AdminExportService,
  ) {}

  private getClientIp(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress ||
           '';
  }

  // =============== 系统配置 ===============

  @Get('system-config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取系统配置' })
  @ApiQuery({ name: 'type', required: false, description: '配置类型' })
  async getSystemConfig(@Query('type') type?: string) {
    return this.adminConfigBasicService.getSystemConfig(type);
  }

  @Post('system-config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新系统配置' })
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminConfigBasicService.updateSystemConfig(dto.configKey, dto.configValue, adminId, adminName, ip);
  }

  @Post('configs/test-payment/:type')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '测试支付配置' })
  @ApiParam({ name: 'type', description: '支付类型：alipay/wechat' })
  async testPayment(@Param('type') type: 'alipay' | 'wechat') {
    return this.adminConfigBasicService.testPayment(type);
  }

  @Post('configs/test-sms')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '测试短信配置' })
  async testSms(@Body() body: { phone: string }) {
    return this.adminConfigBasicService.testSms(body.phone);
  }

  // =============== 公告管理 ===============

  @Post('announcements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '发送系统公告' })
  async sendAnnouncement(@Body() dto: SendAnnouncementDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminNotificationService.sendSystemAnnouncement(dto.title, dto.content, adminId, adminName, ip);
  }

  // =============== 通知管理 ===============

  @Get('notifications')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取通知列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'type', required: false, description: '通知类型' })
  async getNotificationList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    return this.adminNotificationService.getNotificationList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      type,
    });
  }

  @Post('notifications/send')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '发送通知' })
  async sendNotification(
    @Body() dto: SendNotificationDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminNotificationService.sendNotification(dto, adminId, adminName, ip);
  }

  // =============== 协议管理 ===============

  @Get('agreements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取协议列表' })
  async getAgreements() {
    return this.adminAgreementService.getAgreements();
  }

  @Get('agreements/:key')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取单个协议' })
  @ApiParam({ name: 'key', description: '协议键名' })
  async getAgreement(@Param('key') key: string) {
    return this.adminAgreementService.getAgreement(key);
  }

  @Post('agreements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '保存协议' })
  async saveAgreement(@Body() dto: SaveAgreementDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminAgreementService.saveAgreement(dto, adminId, adminName, ip);
  }

  @Delete('agreements/:key')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除协议' })
  @ApiParam({ name: 'key', description: '协议键名' })
  async deleteAgreement(@Param('key') key: string, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminAgreementService.deleteAgreement(key, adminId, adminName, ip);
  }

  // =============== 数据导出 ===============

  @Get('export/users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '导出用户数据' })
  @ApiQuery({ name: 'status', required: false, description: '用户状态' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async exportUsers(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminExportService.exportUsers({
      status: status ? Number.parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('export/orders')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '导出订单数据' })
  @ApiQuery({ name: 'status', required: false, description: '订单状态' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async exportOrders(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminExportService.exportOrders({
      status: status ? Number.parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('export/adoptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '导出领养数据' })
  @ApiQuery({ name: 'status', required: false, description: '领养状态' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async exportAdoptions(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminExportService.exportAdoptions({
      status: status ? Number.parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('export/feed-bills')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '导出饲料费账单数据' })
  @ApiQuery({ name: 'status', required: false, description: '账单状态' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async exportFeedBills(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminExportService.exportFeedBills({
      status: status ? Number.parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }
}
