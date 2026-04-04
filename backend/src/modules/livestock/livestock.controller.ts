import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { LivestockService } from './livestock.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('活体')
@Controller('livestock')
export class LivestockController {
  constructor(private readonly livestockService: LivestockService) {}

  /**
   * 获取活体类型列表
   */
  @Public()
  @Get('types')
  @ApiOperation({ summary: '获取活体类型列表' })
  @ApiResponse({ status: 200, description: '返回活体类型列表' })
  async getTypes() {
    return this.livestockService.getTypes();
  }

  /**
   * 获取活体列表
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '获取活体列表' })
  @ApiQuery({ name: 'typeId', required: false, description: '类型ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 10 })
  @ApiResponse({ status: 200, description: '返回活体列表' })
  async getList(
    @Query('typeId') typeId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.livestockService.getList({
      typeId,
      status: 1,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });
  }

  /**
   * 获取活体详情
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取活体详情' })
  @ApiParam({ name: 'id', description: '活体ID' })
  @ApiResponse({ status: 200, description: '返回活体详情' })
  @ApiResponse({ status: 404, description: '活体不存在' })
  async getById(@Param('id') id: string) {
    return this.livestockService.getById(id);
  }
}
