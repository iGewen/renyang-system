import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 安全修复 B-SEC-007：添加安全 HTTP 头保护
  app.use(helmet());

  // 跨域配置 - 安全修复：未配置时拒绝跨域请求
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map(s => s.trim()),
      credentials: true,
    });
  } else if (process.env.NODE_ENV !== 'production') {
    // 仅开发环境允许所有来源
    app.enableCors({
      origin: true,
      credentials: true,
    });
  }
  // 生产环境未配置 CORS_ORIGIN 时不启用 CORS

  // 静态文件服务（用于访问上传的文件）
  // 安全提示：此静态文件服务全局开放，无需认证即可访问
  // 风险：任何人都可以通过 URL 直接访问上传的文件
  // 建议：
  //   1. 敏感文件应使用独立存储服务并通过 API 返回签名 URL
  //   2. 可添加中间件进行访问控制（如检查 Referer 或实现基于用户权限的文件访问）
  //   3. 考虑将上传文件存储到对象存储服务（如阿里云 OSS、AWS S3）并配置访问控制
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局响应转换拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger API文档配置 - 仅在非生产环境启用
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('云端牧场 API')
      .setDescription('云端牧场后端API文档')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: '输入JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('认证', '用户认证相关接口')
      .addTag('用户', '用户信息管理')
      .addTag('活体', '活体动物管理')
      .addTag('订单', '订单管理')
      .addTag('领养', '领养管理')
      .addTag('饲料费', '饲料费账单管理')
      .addTag('买断', '买断管理')
      .addTag('退款', '退款管理')
      .addTag('支付', '支付相关')
      .addTag('余额', '余额管理')
      .addTag('通知', '消息通知')
      .addTag('管理员', '后台管理接口')
      .addTag('文件上传', '文件上传相关接口')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  if (!isProduction) {
    logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
