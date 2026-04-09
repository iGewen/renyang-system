import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('系统')
@Controller()
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200, description: '服务正常' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cloud-ranch-backend',
    };
  }
}
