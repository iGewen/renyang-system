import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsNotEmpty, IsIn, IsObject, Min, Max } from 'class-validator';

// =============== 支付相关 DTO ===============

export class CreatePaymentDto {
  @ApiProperty({ description: '订单类型', enum: ['adoption', 'feed', 'redemption', 'recharge'] })
  @IsString()
  @IsNotEmpty()
  orderType: string;

  @ApiProperty({ description: '订单ID (充值时可选)' })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiProperty({ description: '支付金额' })
  @IsNumber()
  @Min(0.01, { message: '支付金额必须大于0' })
  @Max(1000000, { message: '支付金额不能超过100万' })
  amount: number;

  @ApiProperty({ description: '支付方式', enum: ['balance', 'alipay', 'wechat'] })
  @IsIn(['balance', 'alipay', 'wechat'])
  paymentMethod: string;
}

// 充值专用 DTO
export class CreateRechargeDto {
  @ApiProperty({ description: '充值金额' })
  @IsNumber()
  @Min(0.01, { message: '充值金额必须大于0' })
  @Max(1000000, { message: '充值金额不能超过100万' })
  amount: number;

  @ApiProperty({ description: '支付方式', enum: ['alipay', 'wechat'] })
  @IsIn(['alipay', 'wechat'])
  paymentMethod: string;
}

// 支付宝回调验证 DTO
export class AlipayNotifyDto {
  @IsString()
  @IsNotEmpty()
  notify_time: string;

  @IsString()
  @IsNotEmpty()
  notify_type: string;

  @IsString()
  @IsNotEmpty()
  notify_id: string;

  @IsString()
  @IsNotEmpty()
  app_id: string;

  @IsString()
  @IsNotEmpty()
  out_trade_no: string;

  @IsString()
  @IsNotEmpty()
  trade_status: string;

  @IsString()
  trade_no: string;

  @IsOptional()
  @IsString()
  total_amount?: string;

  @IsOptional()
  @IsString()
  buyer_id?: string;

  @IsOptional()
  @IsString()
  gmt_payment?: string;
}

// 微信支付回调验证 DTO
export class WechatNotifyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  create_time: string;

  @IsString()
  @IsNotEmpty()
  resource_type: string;

  @IsString()
  @IsNotEmpty()
  event_type: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsObject()
  resource: {
    original_type: string;
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
  };
}
