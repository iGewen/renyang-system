import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminLivestockService } from '../services';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { CreateLivestockTypeDto, UpdateLivestockTypeDto, CreateLivestockDto, UpdateLivestockDto } from '../dto';

@ApiTags('管理员 - 畜禽管理')
@Controller('admin')
@UseGuards(AdminGuard)
@RequireAdmin()
export class AdminLivestockController {
  constructor(private readonly adminLivestockService: AdminLivestockService) {}

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return forwardedStr?.trim() ||
           req.headers['x-real-ip'] as string ||
           req.ip ||
           req.socket.remoteAddress ||
           '';
  }

  private getUserAgent(req: any): string {
    return req.headers['user-agent'] || '';
  }

  // =============== 活体类型管理 ===============

  @Get('livestock-types')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取活体类型列表' })
  async getLivestockTypeList() {
    return this.adminLivestockService.getLivestockTypeList();
  }

  @Post('livestock-types')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建活体类型' })
  async createLivestockType(@Body() dto: CreateLivestockTypeDto, @Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminLivestockService.createLivestockType(dto, adminId, adminName, ip);
  }

  @Put('livestock-types/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体类型' })
  @ApiParam({ name: 'id', description: '类型ID' })
  async updateLivestockType(
    @Param('id') id: string,
    @Body() dto: UpdateLivestockTypeDto,
    @Req() req: Request,
  ) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminLivestockService.updateLivestockType(id, dto, adminId, adminName, ip);
  }

  @Delete('livestock-types/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除活体类型' })
  @ApiParam({ name: 'id', description: '类型ID' })
  async deleteLivestockType(@Param('id') id: string, @Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminLivestockService.deleteLivestockType(id, adminId, adminName, ip);
  }

  // =============== 活体管理 ===============

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
    return this.adminLivestockService.getLivestockList({
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      typeId,
      status: status ? Number.parseInt(status) : undefined,
      keyword,
    });
  }

  @Post('livestock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建活体' })
  async createLivestock(@Body() dto: CreateLivestockDto, @Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminLivestockService.createLivestock(dto, adminId, adminName, ip);
  }

  @Put('livestock/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async updateLivestock(
    @Param('id') id: string,
    @Body() dto: UpdateLivestockDto,
    @Req() req: Request,
  ) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    return this.adminLivestockService.updateLivestock(id, dto, adminId, adminName, ip);
  }

  @Post('livestock/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新活体状态' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async updateLivestockStatus(
    @Param('id') id: string,
    @Body('status') status: string | number,
    @Req() req: Request,
  ) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    let statusCode: number;
    if (typeof status === 'string') {
      statusCode = status === 'on_sale' ? 1 : 2;
    } else {
      statusCode = status;
    }
    return this.adminLivestockService.updateLivestockStatus(id, statusCode, adminId, adminName, ip);
  }

  @Delete('livestock/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除活体' })
  @ApiParam({ name: 'id', description: '活体ID' })
  async deleteLivestock(@Param('id') id: string, @Req() req: Request) {
    const adminId = req.user!.id;
    const adminName = req.user!.username || '';
    const ip = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);
    return this.adminLivestockService.deleteLivestock(id, adminId, adminName, ip, userAgent);
  }
}
