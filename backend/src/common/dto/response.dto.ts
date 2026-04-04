import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ description: '状态码', example: 200 })
  code: number;

  @ApiProperty({ description: '消息', example: 'success' })
  message: string;

  @ApiProperty({ description: '数据' })
  data: T;

  @ApiProperty({ description: '时间戳', example: 1712198400000 })
  timestamp: number;
}

export class PaginationDto {
  @ApiProperty({ description: '当前页', example: 1 })
  page: number;

  @ApiProperty({ description: '每页数量', example: 10 })
  pageSize: number;

  @ApiProperty({ description: '总数量', example: 100 })
  total: number;

  @ApiProperty({ description: '总页数', example: 10 })
  totalPages: number;
}

export class PaginatedResponseDto<T> extends PaginationDto {
  @ApiProperty({ description: '数据列表', type: [Object] })
  list: T[];
}
