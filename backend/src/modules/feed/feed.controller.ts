import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RequireAdmin } from '@/common/decorators/admin-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsNumber, IsOptional, IsNumberString } from 'class-validator';

class AdjustBillDto {
  @IsNumber()
  adjustedAmount: number;

  @IsOptional()
  reason?: string;
}

class WaiveBillDto {
  @IsOptional()
  reason?: string;
}

class ResolveExceptionDto {
  @IsOptional()
  action: 'contact' | 'terminate' | 'continue';

  @IsOptional()
  remark?: string;
}

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // =============== 用户端接口 ===============

  /**
   * 获取我的饲料费账单（通过领养ID）
   */
  @Get('my-bills')
  @UseGuards(JwtAuthGuard)
  async getMyFeedBills(
    @CurrentUser('id') userId: string,
    @Query('adoptionId') adoptionId?: string,
  ) {
    return this.feedService.getMyFeedBills(userId, adoptionId);
  }

  /**
   * 获取账单详情
   */
  @Get('bills/:billId')
  @UseGuards(JwtAuthGuard)
  async getFeedBillById(
    @Param('billId') billId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.feedService.getFeedBillById(billId, userId);
  }

  // =============== 管理端接口 ===============

  /**
   * 获取饲料费账单列表（管理员）
   */
  @Get('admin/bills')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getFeedBillList(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.feedService.getFeedBillList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status: status ? parseInt(status) : undefined,
      keyword,
    });
  }

  /**
   * 调整饲料费金额
   */
  @Post('admin/bills/:billId/adjust')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async adjustFeedBill(
    @Param('billId') billId: string,
    @Body() dto: AdjustBillDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.feedService.adjustFeedBill(
      billId,
      dto.adjustedAmount,
      dto.reason || '',
      adminId,
    );
  }

  /**
   * 免除饲料费
   */
  @Post('admin/bills/:billId/waive')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async waiveFeedBill(
    @Param('billId') billId: string,
    @Body() dto: WaiveBillDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.feedService.waiveFeedBill(billId, dto.reason || '', adminId);
  }

  /**
   * 免除滞纳金
   */
  @Post('admin/bills/:billId/waive-late-fee')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async waiveLateFee(
    @Param('billId') billId: string,
    @Body() dto: WaiveBillDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.feedService.waiveLateFee(billId, dto.reason || '', adminId);
  }

  /**
   * 获取异常领养列表
   */
  @Get('admin/exceptions')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async getExceptionAdoptions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.feedService.getExceptionAdoptions(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }

  /**
   * 处理异常领养
   */
  @Post('admin/exceptions/:adoptionId/resolve')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async resolveException(
    @Param('adoptionId') adoptionId: string,
    @Body() dto: ResolveExceptionDto,
  ) {
    return this.feedService.resolveException(
      adoptionId,
      dto.action,
      dto.remark || '',
    );
  }

  /**
   * 手动触发生成饲料费账单（定时任务测试）
   */
  @Post('admin/generate-bills')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async generateFeedBills() {
    await this.feedService.generateFeedBills();
    return { success: true, message: '饲料费账单生成完成' };
  }

  /**
   * 手动触发计算滞纳金（定时任务测试）
   */
  @Post('admin/calculate-late-fees')
  @UseGuards(AdminGuard)
  @RequireAdmin()
  async calculateLateFees() {
    await this.feedService.calculateLateFees();
    return { success: true, message: '滞纳金计算完成' };
  }
}
