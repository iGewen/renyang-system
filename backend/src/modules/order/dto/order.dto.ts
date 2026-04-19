import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

// =============== 订单相关 DTO ===============

export class CreateOrderDto {
  @ApiProperty({ description: '活体ID' })
  @IsString()
  @IsNotEmpty({ message: '活体ID不能为空' })
  livestockId: string;

  @ApiProperty({ description: '客户端幂等键（防止重复下单）' })
  @IsString()
  @IsNotEmpty({ message: '客户端幂等键不能为空' })
  clientOrderId: string;
}
