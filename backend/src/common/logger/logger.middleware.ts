import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLogger } from './app.logger';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  // 敏感字段列表
  private readonly sensitiveQueryFields = ['token', 'code', 'state', 'ticket', 'auth', 'session', 'secret', 'key'];

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // 记录请求开始
    this.logger.log(
      `--> ${req.method} ${req.url}`,
      'HttpRequest',
      {
        ip: req.ip,
        userId: (req as any).user?.id,
        userAgent: req.headers['user-agent'],
        body: this.sanitizeBody(req.body),
        query: this.sanitizeQuery(req.query),
      },
    );

    // 监听响应完成
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      this.logger.request(req, res, duration);

      // 根据状态码选择日志级别
      if (res.statusCode >= 400) {
        this.logger.warn(
          `<-- ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
          'HttpResponse',
          {
            ip: req.ip,
            userId: (req as any).user?.id,
          },
        );
      } else {
        this.logger.log(
          `<-- ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
          'HttpResponse',
          {
            ip: req.ip,
            userId: (req as any).user?.id,
          },
        );
      }
    });

    next();
  }

  /**
   * 清理敏感数据
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'newPassword', 'oldPassword', 'token', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '******';
      }
    }

    return sanitized;
  }

  /**
   * 清理 query 参数中的敏感信息
   */
  private sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    const sanitized = { ...query };

    for (const field of this.sensitiveQueryFields) {
      if (sanitized[field]) {
        sanitized[field] = '******';
      }
    }

    return sanitized;
  }
}
