import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RefundService } from './refund.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsString } from 'class-validator';

class ApplyRefundDto {
  @IsString()
  orderType: string;

  @IsString()
  orderId: string;

  @IsString()
  reason: string;
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
}
