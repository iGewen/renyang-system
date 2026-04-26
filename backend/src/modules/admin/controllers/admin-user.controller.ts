import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUserService } from '../services';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { AdjustBalanceDto, UpdateUserInfoDto } from '../dto';

@ApiTags('管理员 - 用户管理')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  private getClientIp(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress ||
           '';
  }

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
    return this.adminUserService.getUserList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      keyword,
      status: status ? Number.parseInt(status) : undefined,
    });
  }

  @Get('users/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户详情' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminUserService.getUserDetail(id);
  }

  @Get('users/:id/adoptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取用户领养记录' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async getUserAdoptions(@Param('id') id: string) {
    return this.adminUserService.getUserAdoptions(id);
  }

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
    return this.adminUserService.updateUserStatus(id, status, adminId, adminName, ip);
  }

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
    return this.adminUserService.updateUserInfo(id, dto, adminId, adminName, ip);
  }

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
    return this.adminUserService.adjustUserBalance(id, dto.amount, dto.reason, adminId, adminName, ip);
  }

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
    return this.adminUserService.getUserOrders(id, page || 1, pageSize || 10);
  }

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
    return this.adminUserService.getUserBalanceLogs(id, page || 1, pageSize || 10);
  }

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
    return this.adminUserService.getUserPayments(id, page || 1, pageSize || 10);
  }
}
