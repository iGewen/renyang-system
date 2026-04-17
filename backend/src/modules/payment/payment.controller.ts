import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UserStatusGuard, UserStatus, MIN_STATUS_KEY } from '@/common/guards/user-status.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { IsIn, IsNumber, IsOptional, IsString, IsNotEmpty } from 'class-validator';

class CreatePaymentDto {
  @ApiProperty({ description: '订单类型', enum: ['adoption', 'feed', 'redemption', 'recharge'] })
  @IsString()
  @IsNotEmpty()
  orderType: string;

  @ApiProperty({ description: '订单ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: '支付金额' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: '支付方式', enum: ['balance', 'alipay', 'wechat'] })
  @IsIn(['balance', 'alipay', 'wechat'])
  paymentMethod: string;
}

@ApiTags('支付')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 创建支付
   */
  @Post()
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建支付' })
  @ApiResponse({ status: 201, description: '支付创建成功' })
  async createPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createPayment(
      userId,
      dto.orderType,
      dto.orderId,
      dto.amount,
      dto.paymentMethod,
    );
  }

  /**
   * 查询支付状态
   */
  @Get(':paymentNo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '查询支付状态' })
  @ApiParam({ name: 'paymentNo', description: '支付单号' })
  @ApiResponse({ status: 200, description: '返回支付状态' })
  async getPaymentStatus(@Param('paymentNo') paymentNo: string) {
    return this.paymentService.getPaymentStatus(paymentNo);
  }

  /**
   * 支付宝支付页面
   */
  @Get('alipay/pay')
  @Public()
  @ApiOperation({ summary: '支付宝支付页面' })
  @ApiQuery({ name: 'paymentNo', description: '支付单号' })
  async alipayPay(@Query('paymentNo') paymentNo: string) {
    return this.paymentService.getAlipayPayUrl(paymentNo);
  }

  /**
   * 支付宝回调
   */
  @Post('alipay/notify')
  @Public()
  @ApiOperation({ summary: '支付宝异步回调' })
  async alipayNotify(@Body() data: any) {
    return this.paymentService.handleAlipayNotify(data);
  }

  /**
   * 支付宝返回页面
   */
  @Get('alipay/return')
  @Public()
  @ApiOperation({ summary: '支付宝同步返回' })
  async alipayReturn(@Query() query: any) {
    return { success: true, message: '支付完成', data: query };
  }

  /**
   * 微信支付页面
   */
  @Get('wechat/pay')
  @Public()
  @ApiOperation({ summary: '微信支付页面' })
  @ApiQuery({ name: 'paymentNo', description: '支付单号' })
  async wechatPay(@Query('paymentNo') paymentNo: string, @Req() req: any) {
    const clientIp = req.ip || req.connection.remoteAddress;
    return this.paymentService.getWechatPayUrl(paymentNo, clientIp);
  }

  /**
   * 微信回调
   * 安全修复：添加签名验证，防止伪造回调
   */
  @Post('wechat/notify')
  @Public()
  @ApiOperation({ summary: '微信支付异步回调' })
  async wechatNotify(@Body() data: any, @Req() req: any) {
    // 安全修复：验证签名
    const headers = req.headers;
    const body = JSON.stringify(data);
    const isValid = await this.paymentService.verifyWechatNotify(headers, body);
    if (!isValid) {
      return { code: 'FAIL', message: '签名验证失败' };
    }
    return this.paymentService.handleWechatNotify(data);
  }

  /**
   * 微信退款回调
   */
  @Post('wechat/refund-notify')
  @Public()
  @ApiOperation({ summary: '微信退款异步回调' })
  async wechatRefundNotify(@Body() data: any, @Req() req: any) {
    // 验证签名
    const headers = req.headers;
    const body = JSON.stringify(data);
    const isValid = await this.paymentService.verifyWechatNotify(headers, body);
    if (!isValid) {
      return { code: 'FAIL', message: '签名验证失败' };
    }
    return this.paymentService.handleWechatRefundNotify(data);
  }
}
