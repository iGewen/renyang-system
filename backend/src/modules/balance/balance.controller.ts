import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('balance')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * 获取用户余额
   */
  @Get()
  async getBalance(@CurrentUser('id') userId: string) {
    return this.balanceService.getBalance(userId);
  }

  /**
   * 获取余额变动记录
   */
  @Get('logs')
  async getBalanceLogs(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.balanceService.getBalanceLogs(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  /**
   * 获取充值记录
   */
  @Get('recharge-logs')
  async getRechargeLogs(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.balanceService.getRechargeLogs(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  /**
   * 获取消费记录
   */
  @Get('consume-logs')
  async getConsumeLogs(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.balanceService.getConsumeLogs(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }
}
