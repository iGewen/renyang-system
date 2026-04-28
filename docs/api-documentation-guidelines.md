# API 文档编写规范

本项目使用 NestJS + Swagger 自动生成 API 文档。

## 文档地址

- 开发环境：`http://localhost:3000/api/docs`
- 生产环境：禁用（安全考虑）

## 新增 API 必须遵循的规范

### 1. Controller 类必须添加 `@ApiTags`

```typescript
@ApiTags('模块名称')
@Controller('path')
export class XxxController {}
```

### 2. 每个 API 方法必须添加 `@ApiOperation`

```typescript
@Get()
@ApiOperation({ summary: '获取列表' })
async getList() {}
```

### 3. 请求参数必须添加装饰器

```typescript
@Get(':id')
@ApiOperation({ summary: '获取详情' })
@ApiParam({ name: 'id', description: '记录ID' })
async getById(@Param('id') id: string) {}
```

```typescript
@Get()
@ApiOperation({ summary: '查询列表' })
@ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
@ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 20 })
async getList(@Query() query: ListQueryDto) {}
```

### 4. DTO 必须添加 `@ApiProperty`

```typescript
export class CreateXxxDto {
  @ApiProperty({ description: '名称', example: '示例名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '金额', example: 100.00 })
  @IsNumber()
  amount: number;
}
```

### 5. 响应格式建议

对于标准响应，可以使用：

```typescript
@ApiResponse({
  status: 200,
  description: '成功',
  type: XxxResponseDto,
})
```

## 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| Tag名称 | 中文，简洁 | `订单`、`用户`、`领养` |
| API summary | 中文，动词开头 | `获取订单列表`、`创建领养记录` |
| 参数描述 | 中文 | `订单ID`、`用户编号` |

## 检查清单

新增 API 时，请确认：

- [ ] Controller 类有 `@ApiTags` 装饰器
- [ ] 每个 API 方法有 `@ApiOperation` 装饰器
- [ ] 路径参数有 `@ApiParam` 装饰器
- [ ] 查询参数有 `@ApiQuery` 装饰器
- [ ] DTO 类的每个字段有 `@ApiProperty` 装饰器
- [ ] 启动服务后访问 `/api/docs` 确认文档正确显示

## 示例代码

```typescript
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('示例模块')
@Controller('example')
export class ExampleController {
  @Get()
  @ApiOperation({ summary: '获取示例列表' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 20 })
  async getList(@Query() query: ListQueryDto) {
    // ...
  }

  @Get(':id')
  @ApiOperation({ summary: '获取示例详情' })
  @ApiParam({ name: 'id', description: '示例ID' })
  async getById(@Param('id') id: string) {
    // ...
  }

  @Post()
  @ApiOperation({ summary: '创建示例记录' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(@Body() dto: CreateExampleDto) {
    // ...
  }
}
```
