import { Controller, Get, Param, Query, Post, Body, UseGuards } from '@nestjs/common';
import { AdoptionService } from './adoption.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsString, IsEnum, IsOptional, IsIn } from 'class-validator';

class PayFeedBillDto {
  @IsIn(['alipay', 'wechat', 'balance'])
  paymentMethod: string;
}

@Controller('adoptions')
export class AdoptionController {
  constructor(private readonly adoptionService: AdoptionService) {}

  /**
   * 获取我的领养列表
   */
  @Get()
  async getMyAdoptions(
    @CurrentUser('id') userId: string,
    @Query('status') status?: number,
  ) {
    return this.adoptionService.getMyAdoptions(userId, status);
  }

  /**
   * 获取领养详情
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.getById(id, userId);
  }

  /**
   * 获取饲料费账单列表
   */
  @Get(':id/feed-bills')
  async getFeedBills(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.getFeedBills(id, userId);
  }

  /**
   * 获取饲料费账单详情
   */
  @Get('feed-bills/:billId')
  async getFeedBillById(
    @Param('billId') billId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.getFeedBillById(billId, userId);
  }

  /**
   * 支付饲料费
   */
  @Post('feed-bills/:billId/pay')
  async payFeedBill(
    @Param('billId') billId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PayFeedBillDto,
  ) {
    return this.adoptionService.payFeedBill(billId, userId, dto.paymentMethod);
  }

  /**
   * 申请买断
   */
  @Post(':id/redemption')
  async applyRedemption(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.applyRedemption(id, userId);
  }
}
