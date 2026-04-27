import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('钱包')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * 获取钱包概览
   */
  @Get()
  @ApiOperation({ summary: '获取钱包概览（余额和用户信息）' })
  async getWalletOverview(@CurrentUser('id') userId: string) {
    return this.walletService.getWalletOverview(userId);
  }

  /**
   * 获取交易记录列表
   */
  @Get('transactions')
  @ApiOperation({ summary: '获取交易记录列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 20 })
  @ApiQuery({ name: 'type', required: false, description: '交易类型：payment/refund/recharge/adjust' })
  @ApiQuery({ name: 'paymentMethod', required: false, description: '支付方式：balance/alipay/wechat' })
  @ApiQuery({ name: 'startDate', required: false, description: '开始日期' })
  @ApiQuery({ name: 'endDate', required: false, description: '结束日期' })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.walletService.getTransactions(userId, {
      page: page ? Number.parseInt(page) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize) : 20,
      type,
      paymentMethod,
      startDate,
      endDate,
    });
  }

  /**
   * 获取交易详情
   */
  @Get('transactions/:transactionNo')
  @ApiOperation({ summary: '获取交易详情' })
  @ApiParam({ name: 'transactionNo', description: '交易单号' })
  async getTransactionDetail(
    @CurrentUser('id') userId: string,
    @Param('transactionNo') transactionNo: string,
  ) {
    return this.walletService.getTransactionDetail(userId, transactionNo);
  }
}