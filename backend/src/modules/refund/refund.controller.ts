import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { RefundService } from './refund.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsOptional, IsNumber, IsBoolean, IsString, Min, Max } from 'class-validator';
import { Request } from 'express';

class ApplyRefundDto {
  @IsString()
  orderType: string;

  @IsString()
  orderId: string;

  @IsString()
  reason: string;
}

class AuditRefundDto {
  @IsBoolean()
  passed: boolean;

  @IsNumber()
  refundAmount: number;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  confirmToken?: string;
}

class AdminRefundDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(0.01, { message: '退款金额必须大于0' })
  @Max(1000000, { message: '退款金额不能超过100万' })
  amount: number;

  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  orderType?: string;

  @IsString()
  @IsOptional()
  orderId?: string;
}

@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * 获取我的退款列表
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyRefunds(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.refundService.getMyRefunds(
      userId,
      status ? Number.parseInt(status) : undefined,
    );
  }

  /**
   * 获取退款详情
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getRefundDetail(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundService.getRefundDetail(id, userId);
  }

  /**
   * 申请退款
   */
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  async applyRefund(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyRefundDto,
  ) {
    return this.refundService.applyRefund(
      userId,
      dto.orderType,
      dto.orderId,
      dto.reason,
    );
  }

  /**
   * 取消退款申请
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelRefund(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.refundService.cancelRefund(id, userId);
  }

  /**
   * 审核退款申请（管理员）
   */
  @Post('admin/:id/audit')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async auditRefund(
    @Param('id') id: string,
    @Body() dto: AuditRefundDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.refundService.auditRefund(
      id,
      adminId,
      dto.passed,
      dto.refundAmount,
      dto.remark || '',
      dto.confirmToken,
    );
  }

  /**
   * 管理员直接退款
   */
  @Post('admin/refund')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async adminRefund(
    @CurrentUser('id') adminId: string,
    @CurrentUser('username') adminName: string,
    @Body() dto: AdminRefundDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    return this.refundService.adminRefund(
      adminId,
      dto.userId,
      dto.amount,
      dto.reason,
      dto.orderType,
      dto.orderId,
      adminName,
      ip,
    );
  }

  /**
   * 获取待审核退款列表（管理员）
   */
  @Get('admin/pending')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getPendingRefunds(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.refundService.getPendingRefunds(
      page ? Number.parseInt(page) : 1,
      pageSize ? Number.parseInt(pageSize) : 10,
    );
  }

  /**
   * 获取所有退款列表（管理员）
   */
  @Get('admin/all')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getAllRefunds(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.refundService.getAllRefunds(
      page ? Number.parseInt(page) : 1,
      pageSize ? Number.parseInt(pageSize) : 10,
      status ? Number.parseInt(status) : undefined,
    );
  }
}
