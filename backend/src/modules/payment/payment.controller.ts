import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, SetMetadata, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UserStatusGuard, UserStatus, MIN_STATUS_KEY } from '@/common/guards/user-status.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
// DTO 从独立文件导入
import {
  CreatePaymentDto,
  CreateRechargeDto,
  AlipayNotifyDto,
} from './dto';

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
    // 充值类型时，后端生成 orderId
    let orderId = dto.orderId;

    if (dto.orderType === 'recharge') {
      orderId = `recharge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    if (!orderId) {
      throw new BadRequestException('订单ID不能为空');
    }

    // 安全修复 B-BIZ-035：饲料费类型需要校验 userId
    // paymentService.createPayment 内部已有校验，这里不再重复

    return this.paymentService.createPayment(
      userId,
      dto.orderType,
      orderId,
      dto.amount,
      dto.paymentMethod,
    );
  }

  /**
   * 余额充值（专用接口）
   * 订单ID由后端生成，更安全
   */
  @Post('recharge')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @SetMetadata(MIN_STATUS_KEY, UserStatus.NORMAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '余额充值' })
  @ApiResponse({ status: 201, description: '充值订单创建成功' })
  async createRecharge(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRechargeDto,
  ) {
    // 后端生成订单ID，防止客户端伪造
    const orderId = `recharge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    return this.paymentService.createPayment(
      userId,
      'recharge',
      orderId,
      dto.amount,
      dto.paymentMethod,
    );
  }

  /**
   * 查询支付状态
   * 安全修复：添加 userId 校验，确保用户只能查询自己的支付记录
   */
  @Get(':paymentNo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '查询支付状态' })
  @ApiParam({ name: 'paymentNo', description: '支付单号' })
  @ApiResponse({ status: 200, description: '返回支付状态' })
  async getPaymentStatus(
    @Param('paymentNo') paymentNo: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentService.getPaymentStatus(paymentNo, userId);
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
   * 使用 DTO 进行输入验证
   */
  @Post('alipay/notify')
  @Public()
  @ApiOperation({ summary: '支付宝异步回调' })
  async alipayNotify(@Body() data: AlipayNotifyDto) {
    // DTO 已验证必要字段，验证 trade_status 为已知值
    const validStatuses = ['TRADE_SUCCESS', 'TRADE_FINISHED', 'TRADE_CLOSED', 'WAIT_BUYER_PAY'];
    if (!validStatuses.includes(data.trade_status)) {
      throw new BadRequestException('无效的交易状态');
    }
    return this.paymentService.handleAlipayNotify(data as Record<string, any>);
  }

  /**
   * 支付宝返回页面
   */
  @Get('alipay/return')
  @Public()
  @ApiOperation({ summary: '支付宝同步返回' })
  async alipayReturn(@Query() query: Record<string, any>) {
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
    if (!paymentNo) {
      throw new BadRequestException('缺少支付单号');
    }
    const clientIp = req.ip || req.connection.remoteAddress;
    return this.paymentService.getWechatPayUrl(paymentNo, clientIp);
  }

  /**
   * 微信回调
   * 安全修复：添加签名验证和输入验证，防止伪造回调
   */
  @Post('wechat/notify')
  @Public()
  @ApiOperation({ summary: '微信支付异步回调' })
  async wechatNotify(@Body() data: Record<string, any>, @Req() req: any) {
    // 基础验证：检查必要字段
    if (!data.id || !data.resource_type || !data.event_type || !data.resource) {
      throw new BadRequestException('缺少必要参数');
    }
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
  async wechatRefundNotify(@Body() data: Record<string, any>, @Req() req: any) {
    // 基础验证
    if (!data.id || !data.resource_type || !data.resource) {
      throw new BadRequestException('缺少必要参数');
    }
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
