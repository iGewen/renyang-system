import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AdminOrderService,
  AdminAdoptionService,
  AdminFeedService,
  AdminRedemptionService,
  AdminRefundService,
} from '../services';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuditRedemptionDto, AuditRefundDto, AdminRefundDto } from '../dto';

@ApiTags('管理员 - 订单业务')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminOrderController {
  constructor(
    private readonly adminOrderService: AdminOrderService,
    private readonly adminAdoptionService: AdminAdoptionService,
    private readonly adminFeedService: AdminFeedService,
    private readonly adminRedemptionService: AdminRedemptionService,
    private readonly adminRefundService: AdminRefundService,
  ) {}

  private getClientIp(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress ||
           '';
  }

  // =============== 订单管理 ===============

  @Get('orders')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取订单列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async getOrderList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminOrderService.getOrderList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      status: status ? Number.parseInt(status) : undefined,
      keyword,
      startDate,
      endDate,
    });
  }

  @Get('orders/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'id', description: '订单ID' })
  async getOrderDetail(@Param('id') id: string) {
    return this.adminOrderService.getOrderDetail(id);
  }

  @Delete('orders/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除订单' })
  @ApiParam({ name: 'id', description: '订单ID' })
  async deleteOrder(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @CurrentUser('username') adminName: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    return this.adminOrderService.deleteOrder(id, adminId, adminName, ip);
  }

  // =============== 领养管理 ===============

  @Get('adoptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取领养列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  async getAdoptionList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminAdoptionService.getAdoptionList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      status: status ? Number.parseInt(status) : undefined,
      keyword,
    });
  }

  @Get('adoptions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取领养详情' })
  @ApiParam({ name: 'id', description: '领养ID' })
  async getAdoptionDetail(@Param('id') id: string) {
    return this.adminAdoptionService.getAdoptionDetail(id);
  }

  @Get('adoptions/exception')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取异常领养列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  async getExceptionAdoptions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminAdoptionService.getExceptionAdoptions({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
    });
  }

  @Put('adoptions/:id/resolve')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '处理异常领养' })
  @ApiParam({ name: 'id', description: '领养ID' })
  async resolveException(
    @Param('id') id: string,
    @Body() body: { action: 'contact' | 'terminate' | 'continue'; remark: string },
  ) {
    return this.adminAdoptionService.resolveException(id, body.action, body.remark);
  }

  // =============== 饲料费管理 ===============

  @Get('feed-bills')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取饲料费账单列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  async getFeedBillList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminFeedService.getFeedBillList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      status: status ? Number.parseInt(status) : undefined,
      keyword,
    });
  }

  @Put('feed-bills/:id/adjust')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '调整饲料费账单金额' })
  @ApiParam({ name: 'id', description: '账单ID' })
  async adjustFeedBill(
    @Param('id') id: string,
    @Body() body: { adjustedAmount: number; reason: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    return this.adminFeedService.adjustFeedBill(id, body.adjustedAmount, body.reason || '', adminId);
  }

  @Put('feed-bills/:id/waive')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '免除饲料费账单' })
  @ApiParam({ name: 'id', description: '账单ID' })
  async waiveFeedBill(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    return this.adminFeedService.waiveFeedBill(id, body.reason || '', adminId);
  }

  @Put('feed-bills/:id/waive-late-fee')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '免除滞纳金' })
  @ApiParam({ name: 'id', description: '账单ID' })
  async waiveLateFee(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    return this.adminFeedService.waiveLateFee(id, body.reason || '', adminId);
  }

  // =============== 买断管理 ===============

  @Get('redemptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取买断订单列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  async getRedemptionList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.adminRedemptionService.getRedemptionList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      status: status ? Number.parseInt(status) : undefined,
    });
  }

  @Get('redemptions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取买断订单详情' })
  @ApiParam({ name: 'id', description: '买断订单ID' })
  async getRedemptionDetail(@Param('id') id: string) {
    return this.adminRedemptionService.getRedemptionDetail(id);
  }

  @Post('redemptions/:id/audit')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '审核买断申请' })
  @ApiParam({ name: 'id', description: '买断订单ID' })
  async auditRedemption(
    @Param('id') id: string,
    @Body() dto: AuditRedemptionDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminRedemptionService.auditRedemption(id, dto.approved, dto.adjustedAmount, dto.remark, adminId, adminName, ip);
  }

  // =============== 退款管理 ===============

  @Get('refunds')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取退款订单列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  async getRefundList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.adminRefundService.getRefundList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      status: status ? Number.parseInt(status) : undefined,
    });
  }

  @Get('refunds/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取退款订单详情' })
  @ApiParam({ name: 'id', description: '退款订单ID' })
  async getRefundDetail(@Param('id') id: string) {
    return this.adminRefundService.getRefundDetail(id);
  }

  @Post('refunds/:id/audit')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '审核退款申请' })
  @ApiParam({ name: 'id', description: '退款订单ID' })
  async auditRefund(
    @Param('id') id: string,
    @Body() dto: AuditRefundDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminRefundService.auditRefund(id, dto.approved, dto.remark, adminId, adminName, ip);
  }

  @Post('refunds/refund')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '管理员直接退款' })
  async adminRefund(
    @Body() dto: AdminRefundDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminRefundService.adminRefund({
      adminId,
      adminName,
      userId: dto.userId,
      amount: dto.amount,
      reason: dto.reason,
      orderType: dto.orderType,
      orderId: dto.orderId,
      ip,
    });
  }
}
