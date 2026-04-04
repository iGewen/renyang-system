import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class CreateOrderDto {
  @ApiProperty({ description: '活体ID' })
  @IsString()
  @IsNotEmpty({ message: '活体ID不能为空' })
  livestockId: string;

  @ApiProperty({ description: '客户端幂等键（防止重复下单）' })
  @IsString()
  @IsNotEmpty({ message: '客户端幂等键不能为空' })
  clientOrderId: string;
}

@ApiTags('订单')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建领养订单
   */
  @Post('adoption')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '创建领养订单' })
  @ApiResponse({ status: 201, description: '订单创建成功' })
  @ApiResponse({ status: 400, description: '参数错误或库存不足' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.create(userId, dto.livestockId, dto.clientOrderId);
  }

  /**
   * 取消订单
   */
  @Post('adoption/:orderId/cancel')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '取消订单' })
  @ApiParam({ name: 'orderId', description: '订单ID' })
  @ApiResponse({ status: 200, description: '订单取消成功' })
  @ApiResponse({ status: 400, description: '订单状态不允许取消' })
  async cancel(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.orderService.cancel(userId, orderId);
  }

  /**
   * 获取订单详情
   */
  @Get('adoption/:orderId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'orderId', description: '订单ID' })
  @ApiResponse({ status: 200, description: '返回订单详情' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async getById(
    @Param('orderId') orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orderService.getById(orderId, userId);
  }

  /**
   * 获取我的订单列表
   */
  @Get('adoption')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取我的订单列表' })
  @ApiQuery({ name: 'status', required: false, description: '订单状态' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 10 })
  @ApiResponse({ status: 200, description: '返回订单列表' })
  async getMyOrders(
    @CurrentUser('id') userId: string,
    @Query('status') status?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.orderService.getUserOrders(
      userId,
      status ? Number(status) : undefined,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }
}
