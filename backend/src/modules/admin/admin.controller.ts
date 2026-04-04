import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';
import { Public } from '@/common/decorators/public.decorator';

// DTOs
class LoginDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  password: string;
}

class ChangePasswordDto {
  @ApiProperty({ description: '原密码' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  newPassword: string;
}

class CreateLivestockTypeDto {
  @ApiProperty({ description: '类型名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateLivestockTypeDto {
  @ApiPropertyOptional({ description: '类型名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class CreateLivestockDto {
  @ApiProperty({ description: '活体名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '类型ID' })
  @IsString()
  typeId: string;

  @ApiProperty({ description: '价格' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: '月饲料费' })
  @IsNumber()
  monthlyFeedFee: number;

  @ApiProperty({ description: '买断所需月数' })
  @IsNumber()
  redemptionMonths: number;

  @ApiPropertyOptional({ description: '图片列表', type: [String] })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '库存' })
  @IsNumber()
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: '是否上架' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateLivestockDto {
  @ApiPropertyOptional({ description: '活体名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '类型ID' })
  @IsString()
  @IsOptional()
  typeId?: string;

  @ApiPropertyOptional({ description: '价格' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: '月饲料费' })
  @IsNumber()
  @IsOptional()
  monthlyFeedFee?: number;

  @ApiPropertyOptional({ description: '买断所需月数' })
  @IsNumber()
  @IsOptional()
  redemptionMonths?: number;

  @ApiPropertyOptional({ description: '图片列表', type: [String] })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '库存' })
  @IsNumber()
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: '是否上架' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateSystemConfigDto {
  @ApiProperty({ description: '配置键' })
  @IsString()
  configKey: string;

  @ApiProperty({ description: '配置值' })
  @IsObject()
  configValue: any;
}

class SendAnnouncementDto {
  @ApiProperty({ description: '公告标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '公告内容' })
  @IsString()
  content: string;
}

class CreateAdminDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: '姓名' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: '角色：1超级管理员 2普通管理员', enum: [1, 2] })
  @IsNumber()
  @IsIn([1, 2])
  role: number;
}

@ApiTags('管理员')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
    const ip = req.ip || req.connection.remoteAddress;
    return this.adminService.login(dto.username, dto.password, ip);
  }

  /**
   * 获取当前管理员信息
   */
  @Get('auth/info')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前管理员信息' })
  @ApiResponse({ status: 200, description: '返回管理员信息' })
  async getAdminInfo(@Req() req: any) {
    const adminId = req.user?.sub;
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
    const adminId = req.user?.sub;
    return this.adminService.changePassword(adminId, dto.oldPassword, dto.newPassword);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateUserStatus(id, status, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.createLivestockType(dto, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateLivestockType(id, dto, adminId, adminName);
  }

  /**
   * 删除活体类型
   */
  @Delete('livestock-types/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除活体类型' })
  @ApiParam({ name: 'id', description: '类型ID' })
  async deleteLivestockType(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.deleteLivestockType(id, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.createLivestock(dto, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateLivestock(id, dto, adminId, adminName);
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
    @Body('status') status: number,
    @Req() req: any,
  ) {
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateLivestockStatus(id, status, adminId, adminName);
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
  @ApiQuery({ name: 'orderType', required: false, description: '订单类型' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async getOrderList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
    @Query('keyword') keyword?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getOrderList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
      orderType,
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateSystemConfig(dto.configKey, dto.configValue, adminId, adminName);
  }

  // =============== 公告管理 ===============

  /**
   * 发送系统公告
   */
  @Post('announcements')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '发送系统公告' })
  async sendAnnouncement(@Body() dto: SendAnnouncementDto, @Req() req: any) {
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.sendSystemAnnouncement(dto.title, dto.content, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.createAdmin(dto, adminId, adminName);
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
    const adminId = req.user?.sub;
    const adminName = req.user?.username;
    return this.adminService.updateAdminStatus(id, status, adminId, adminName);
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
}
