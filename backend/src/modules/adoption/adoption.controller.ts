import { Controller, Get, Param, Query, Post, Body, UseGuards, SetMetadata } from '@nestjs/common';
import { AdoptionService } from './adoption.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserStatusGuard, UserStatus, MIN_STATUS_KEY } from '@/common/guards/user-status.guard';
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
   * 通过订单ID获取领养记录
   */
  @Get('order/:orderId')
  async getByOrderId(
    @Param('orderId') orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.getByOrderId(orderId, userId);
  }

  /**
   * 获取饲料费账单详情
   * 注意：此路由必须放在 :id 路由之前，否则 feed-bills 会被当作 id 匹配
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
  @UseGuards(UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  async payFeedBill(
    @Param('billId') billId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PayFeedBillDto,
  ) {
    return this.adoptionService.payFeedBill(billId, userId, dto.paymentMethod);
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
   * 申请买断
   */
  @Post(':id/redemption')
  @UseGuards(UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  async applyRedemption(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adoptionService.applyRedemption(id, userId);
  }
}
