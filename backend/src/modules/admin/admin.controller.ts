import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminManagementService } from './services';
import { Public } from '@/common/decorators/public.decorator';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin, AdminRole } from '@/common/decorators/admin-role.decorator';
import { LoginDto, ChangePasswordDto, CreateAdminDto } from './dto';

@ApiTags('管理员')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminManagementService: AdminManagementService,
  ) {}

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return forwardedStr?.trim() ||
           req.headers['x-real-ip'] as string ||
           req.ip ||
           req.socket.remoteAddress ||
           '';
  }

  private getUserAgent(req: Request): string {
    return req.headers['user-agent'] || '';
  }

  // =============== 认证相关 ===============

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: '管理员登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.login(dto.username, dto.password, ip, userAgent);
  }

  @Get('auth/info')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前管理员信息' })
  @ApiResponse({ status: 200, description: '返回管理员信息' })
  async getAdminInfo(@Req() req: Request) {
    const adminId = req.user!.id;
    return this.adminService.getAdminInfo(adminId);
  }

  @Post('auth/change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const adminId = req.user!.id;
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminService.changePassword(adminId, dto.oldPassword, dto.newPassword, ip, userAgent);
  }

  @Post('auth/verify-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '验证密码' })
  @ApiResponse({ status: 200, description: '密码验证成功' })
  @ApiResponse({ status: 401, description: '密码错误' })
  async verifyPassword(@Body('password') password: string, @Req() req: Request) {
    const adminId = req.user!.id;
    return this.adminService.verifyPassword(adminId, password);
  }

  // =============== 仪表盘 ===============

  @Get('dashboard/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取仪表盘统计数据' })
  @ApiResponse({ status: 200, description: '返回统计数据' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // =============== 管理员管理 ===============

  @Get('admins')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取管理员列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  async getAdminList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminManagementService.getAdminList(
      page ? Number.parseInt(page) : 1,
      pageSize ? Number.parseInt(pageSize) : 20,
    );
  }

  @Post('admins')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建管理员' })
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminManagementService.createAdmin(dto, adminId, adminName, ip);
  }

  @Post('admins/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新管理员状态' })
  @ApiParam({ name: 'id', description: '管理员ID' })
  async updateAdminStatus(
    @Param('id') id: string,
    @Body('status') status: number,
    @Req() req: Request,
  ) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminManagementService.updateAdminStatus(id, status, adminId, adminName, ip);
  }

  // =============== 审计日志 ===============

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
    return this.adminManagementService.getAuditLogs({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      module,
      adminId,
      startDate,
      endDate,
    });
  }

  @Delete('audit-logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '清空审计日志（仅超级管理员）' })
  @RequireAdmin(AdminRole.SUPER_ADMIN)
  async clearAuditLogs(@Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminManagementService.clearAuditLogs(adminId, adminName, ip, userAgent);
  }
}
