import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Public } from '@/common/decorators/public.decorator';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin, AdminRole } from '@/common/decorators/admin-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Request } from 'express';
// DTOs 从独立文件导入
import {
  LoginDto,
  ChangePasswordDto,
  CreateLivestockTypeDto,
  UpdateLivestockTypeDto,
  CreateLivestockDto,
  UpdateLivestockDto,
  UpdateSystemConfigDto,
  SendAnnouncementDto,
  SaveAgreementDto,
  CreateAdminDto,
  AdjustBalanceDto,
  UpdateUserInfoDto,
  SendNotificationDto,
  AuditRedemptionDto,
  AuditRefundDto,
} from './dto';

@ApiTags('管理员')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 获取真实 IP 地址
  private getClientIp(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress ||
           '';
  }

  // 获取 User-Agent
  private getUserAgent(req: any): string {
    return req.headers['user-agent'] || '';
  }

  // =============== 认证相关 ===============

  /**
   * 管理员登录
   */
  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.login(dto.username, dto.password, ip, userAgent);
  }

  /**
   * 获取当前管理员信息
   */
  @Get('auth/info')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前管理员信息' })
  @ApiResponse({ status: 200, description: '返回管理员信息' })
  async getAdminInfo(@Req() req: any) {
    const adminId = req.user?.id;
    return this.adminService.getAdminInfo(adminId);
  }

  /**
   * 修改密码
   */
  @Post('auth/change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const adminId = req.user?.id;
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.changePassword(adminId, dto.oldPassword, dto.newPassword, ip, userAgent);
  }

  /**
   * 验证密码（用于敏感操作确认）
   */
  @Post('auth/verify-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '验证密码' })
  @ApiResponse({ status: 200, description: '密码验证成功' })
  @ApiResponse({ status: 401, description: '密码错误' })
  async verifyPassword(@Body('password') password: string, @Req() req: any) {
    const adminId = req.user?.id;
    return this.adminService.verifyPassword(adminId, password);
  }

  // =============== 仪表盘 ===============

  /**
   * 获取仪表盘统计数据
   */
  @Get('dashboard/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取仪表盘统计数据' })
  @ApiResponse({ status: 200, description: '返回统计数据' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // =============== 用户管理 ===============

  /**
   * 获取用户列表
   */
  @Get('users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  async getUserList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUserList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      keyword,
      status: status ? parseInt(status) : undefined,
    });
  }

  /**
   * 获取用户详情
   */
  @Get('users/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户详情' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  /**
   * 更新用户状态
   */
  @Post('users/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新用户状态' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: number,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.updateUserStatus(id, status, adminId, adminName, ip, userAgent);
  }

  /**
   * 更新用户信息
   */
  @Put('users/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async updateUserInfo(
    @Param('id') id: string,
    @Body() dto: UpdateUserInfoDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.updateUserInfo(id, dto, adminId, adminName, ip);
  }

  /**
   * 调整用户余额
   */
  @Post('users/:id/balance')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '调整用户余额' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async adjustUserBalance(
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.adjustUserBalance(id, dto.amount, dto.reason, adminId, adminName, ip);
  }

  /**
   * 获取用户订单列表
   */
  @Get('users/:id/orders')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户订单列表' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getUserOrders(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getUserOrders(id, page || 1, pageSize || 10);
  }

  /**
   * 获取用户余额明细
   */
  @Get('users/:id/balance-logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户余额明细' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getUserBalanceLogs(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getUserBalanceLogs(id, page || 1, pageSize || 10);
  }

  /**
   * 获取用户支付记录
   */
  @Get('users/:id/payments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户支付记录' })
  @ApiParam({ name: 'id', description: '用户ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getUserPayments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getUserPayments(id, page || 1, pageSize || 10);
  }

  // =============== 活体类型管理 ===============

  /**
   * 获取活体类型列表
   */
  @Get('livestock-types')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取活体类型列表' })
  async getLivestockTypeList() {
    return this.adminService.getLivestockTypeList();
  }

  /**
   * 创建活体类型
   */
  @Post('livestock-types')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建活体类型' })
  async createLivestockType(@Body() dto: CreateLivestockTypeDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.createLivestockType(dto, adminId, adminName, ip);
  }

  /**
   * 更新活体类型
   */
  @Put('livestock-types/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体类型' })
  @ApiParam({ name: 'id', description: '类型ID' })
  async updateLivestockType(
    @Param('id') id: string,
    @Body() dto: UpdateLivestockTypeDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.updateLivestockType(id, dto, adminId, adminName, ip);
  }

  /**
   * 删除活体类型
   */
  @Delete('livestock-types/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除活体类型' })
  @ApiParam({ name: 'id', description: '类型ID' })
  async deleteLivestockType(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.deleteLivestockType(id, adminId, adminName, ip);
  }

  // =============== 活体管理 ===============

  /**
   * 获取活体列表
   */
  @Get('livestock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取活体列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'typeId', required: false, description: '类型ID' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  async getLivestockList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('typeId') typeId?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminService.getLivestockList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      typeId,
      status: status ? parseInt(status) : undefined,
      keyword,
    });
  }

  /**
   * 创建活体
   */
  @Post('livestock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建活体' })
  async createLivestock(@Body() dto: CreateLivestockDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.createLivestock(dto, adminId, adminName, ip);
  }

  /**
   * 更新活体
   */
  @Put('livestock/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async updateLivestock(
    @Param('id') id: string,
    @Body() dto: UpdateLivestockDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.updateLivestock(id, dto, adminId, adminName, ip);
  }

  /**
   * 更新活体状态
   */
  @Post('livestock/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体状态' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async updateLivestockStatus(
    @Param('id') id: string,
    @Body('status') status: string | number,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    // 支持 'on_sale'/'off_sale' 字符串和数字
    const statusCode = typeof status === 'string'
      ? (status === 'on_sale' ? 1 : 2)
      : status;
    return this.adminService.updateLivestockStatus(id, statusCode, adminId, adminName, ip);
  }

  /**
   * 删除活体
   */
  @Delete('livestock/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除活体' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async deleteLivestock(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.deleteLivestock(id, adminId, adminName, ip, userAgent);
  }

  // =============== 订单管理 ===============

  /**
   * 获取订单列表
   */
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
    return this.adminService.getOrderList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
      keyword,
      startDate,
      endDate,
    });
  }

  /**
   * 获取订单详情
   */
  @Get('orders/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'id', description: '订单ID' })
  async getOrderDetail(@Param('id') id: string) {
    return this.adminService.getOrderDetail(id);
  }

  /**
   * 删除订单
   */
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
    return this.adminService.deleteOrder(id, adminId, adminName, ip);
  }

  // =============== 领养管理 ===============

  /**
   * 获取领养列表
   */
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
    return this.adminService.getAdoptionList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
      keyword,
    });
  }

  /**
   * 获取领养详情
   */
  @Get('adoptions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取领养详情' })
  @ApiParam({ name: 'id', description: '领养ID' })
  async getAdoptionDetail(@Param('id') id: string) {
    return this.adminService.getAdoptionDetail(id);
  }

  // =============== 饲料费管理 ===============

  /**
   * 获取饲料费账单列表
   */
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
    return this.adminService.getFeedBillList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
      keyword,
    });
  }

  // =============== 系统配置 ===============

  /**
   * 获取系统配置
   */
  @Get('system-config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取系统配置' })
  @ApiQuery({ name: 'type', required: false, description: '配置类型' })
  async getSystemConfig(@Query('type') type?: string) {
    return this.adminService.getSystemConfig(type);
  }

  /**
   * 更新系统配置
   */
  @Post('system-config')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新系统配置' })
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.updateSystemConfig(dto.configKey, dto.configValue, adminId, adminName, ip);
  }

  // =============== 公告管理 ===============

  /**
   * 发送系统公告
   */
  @Post('announcements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '发送系统公告' })
  async sendAnnouncement(@Body() dto: SendAnnouncementDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.sendSystemAnnouncement(dto.title, dto.content, adminId, adminName, ip);
  }

  // =============== 通知管理 ===============

  /**
   * 获取通知列表
   */
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
    return this.adminService.getNotificationList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      type,
    });
  }

  /**
   * 发送通知
   */
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
    return this.adminService.sendNotification(dto, adminId, adminName, ip);
  }

  // =============== 管理员管理 ===============

  /**
   * 获取管理员列表
   */
  @Get('admins')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取管理员列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  async getAdminList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.getAdminList(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  /**
   * 创建管理员
   */
  @Post('admins')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建管理员' })
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.createAdmin(dto, adminId, adminName, ip);
  }

  /**
   * 更新管理员状态
   */
  @Post('admins/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新管理员状态' })
  @ApiParam({ name: 'id', description: '管理员ID' })
  async updateAdminStatus(
    @Param('id') id: string,
    @Body('status') status: number,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.updateAdminStatus(id, status, adminId, adminName, ip);
  }

  // =============== 审计日志 ===============

  /**
   * 获取审计日志
   */
  @Get('audit-logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取审计日志' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'module', required: false, description: '模块' })
  @ApiQuery({ name: 'adminId', required: false, description: '管理员ID' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('module') module?: string,
    @Query('adminId') adminId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getAuditLogs({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      module,
      adminId,
      startDate,
      endDate,
    });
  }

  /**
   * 清空审计日志
   * 安全修复：仅超级管理员（role=1）可操作
   */
  @Delete('audit-logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '清空审计日志（仅超级管理员）' })
  @RequireAdmin(AdminRole.SUPER_ADMIN)
  async clearAuditLogs(@Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.clearAuditLogs(adminId, adminName, ip, userAgent);
  }

  // =============== 数据导出 ===============

  /**
   * 导出用户数据
   */
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
    return this.adminService.exportUsers({
      status: status ? parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  /**
   * 导出订单数据
   */
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
    return this.adminService.exportOrders({
      status: status ? parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  /**
   * 导出领养数据
   */
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
    return this.adminService.exportAdoptions({
      status: status ? parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  /**
   * 导出饲料费账单数据
   */
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
    return this.adminService.exportFeedBills({
      status: status ? parseInt(status) : undefined,
      startDate,
      endDate,
    });
  }

  // =============== 买断管理 ===============

  /**
   * 获取买断订单列表
   */
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
    return this.adminService.getRedemptionList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
    });
  }

  /**
   * 获取买断订单详情
   */
  @Get('redemptions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取买断订单详情' })
  @ApiParam({ name: 'id', description: '买断订单ID' })
  async getRedemptionDetail(@Param('id') id: string) {
    return this.adminService.getRedemptionDetail(id);
  }

  /**
   * 审核买断申请
   */
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
    return this.adminService.auditRedemption(id, dto.approved, dto.adjustedAmount, dto.remark, adminId, adminName, ip);
  }

  // =============== 退款管理 ===============

  /**
   * 获取退款订单列表
   */
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
    return this.adminService.getRefundList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
    });
  }

  /**
   * 获取退款订单详情
   */
  @Get('refunds/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取退款订单详情' })
  @ApiParam({ name: 'id', description: '退款订单ID' })
  async getRefundDetail(@Param('id') id: string) {
    return this.adminService.getRefundDetail(id);
  }

  /**
   * 审核退款申请
   */
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
    return this.adminService.auditRefund(id, dto.approved, dto.remark, adminId, adminName, ip);
  }

  // =============== 协议管理 ===============

  /**
   * 获取协议列表
   */
  @Get('agreements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取协议列表' })
  async getAgreements() {
    return this.adminService.getAgreements();
  }

  /**
   * 获取单个协议
   */
  @Get('agreements/:key')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取单个协议' })
  @ApiParam({ name: 'key', description: '协议键名' })
  async getAgreement(@Param('key') key: string) {
    return this.adminService.getAgreement(key);
  }

  /**
   * 保存协议
   */
  @Post('agreements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '保存协议' })
  async saveAgreement(@Body() dto: SaveAgreementDto, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.saveAgreement(dto, adminId, adminName, ip);
  }

  /**
   * 删除协议
   */
  @Delete('agreements/:key')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除协议' })
  @ApiParam({ name: 'key', description: '协议键名' })
  async deleteAgreement(@Param('key') key: string, @Req() req: any) {
    const adminId = req.user?.id;
    const adminName = req.user?.username;
    const ip = this.getClientIp(req);
    return this.adminService.deleteAgreement(key, adminId, adminName, ip);
  }
}
