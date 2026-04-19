import { Controller, Get, Post, Param, Body, Query, UseGuards, SetMetadata } from '@nestjs/common';
import { RedemptionService } from './redemption.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { UserStatusGuard, UserStatus, MIN_STATUS_KEY } from '@/common/guards/user-status.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsIn, IsOptional, IsNumber, IsBoolean, IsNumberString } from 'class-validator';

class PayRedemptionDto {
  @IsIn(['alipay', 'wechat', 'balance'])
  paymentMethod: string;
}

class AuditRedemptionDto {
  @IsBoolean()
  passed: boolean;

  @IsNumber()
  @IsOptional()
  adjustedAmount?: number;

  @IsOptional()
  remark?: string;
}

@Controller('redemptions')
export class RedemptionController {
  constructor(private readonly redemptionService: RedemptionService) {}

  /**
   * 获取我的买断列表
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyRedemptions(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.redemptionService.getMyRedemptions(
      userId,
      status ? parseInt(status) : undefined,
    );
  }

  /**
   * 获取买断详情
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getRedemptionDetail(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.redemptionService.getRedemptionDetail(id, userId);
  }

  /**
   * 获取买断预览信息（不创建订单）
   */
  @Get('preview/:adoptionId')
  @UseGuards(JwtAuthGuard)
  async getRedemptionPreview(
    @Param('adoptionId') adoptionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.redemptionService.getRedemptionPreview(adoptionId, userId);
  }

  /**
   * 申请买断
   */
  @Post('apply/:adoptionId')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  async applyRedemption(
    @Param('adoptionId') adoptionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.redemptionService.applyRedemption(adoptionId, userId);
  }

  /**
   * 取消买断申请
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelRedemption(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.redemptionService.cancelRedemption(id, userId);
  }

  /**
   * 支付买断
   */
  @Post(':id/pay')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  async payRedemption(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PayRedemptionDto,
  ) {
    return this.redemptionService.payRedemption(id, userId, dto.paymentMethod);
  }

  /**
   * 审核买断申请（管理员）
   */
  @Post('admin/:id/audit')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async auditRedemption(
    @Param('id') id: string,
    @Body() dto: AuditRedemptionDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.redemptionService.auditRedemption(
      id,
      adminId,
      dto.passed,
      dto.adjustedAmount,
      dto.remark,
    );
  }

  /**
   * 获取待审核买断列表（管理员）
   */
  @Get('admin/pending')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getPendingRedemptions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.redemptionService.getPendingRedemptions(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 10,
    );
  }

  /**
   * 获取所有买断列表（管理员）
   */
  @Get('admin/all')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getAllRedemptions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.redemptionService.getAllRedemptions(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 10,
      status ? parseInt(status) : undefined,
    );
  }
}
