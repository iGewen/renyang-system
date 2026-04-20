import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * AppLogger - 应用程序日志服务
 *
 * 职责说明：
 * 1. 实现 NestJS LoggerService 接口，提供统一的日志记录能力
 * 2. 支持多种日志级别：error, warn, log(info), debug, verbose
 * 3. 日志持久化：将日志写入文件系统，支持日志轮转
 * 4. 业务日志分离：提供 business() 方法记录业务操作日志
 * 5. 请求日志记录：提供 request() 方法记录 HTTP 请求日志
 *
 * 日志文件：
 * - app.log: 所有日志（INFO 及以上）
 * - error.log: 仅错误日志
 * - business.log: 业务操作日志
 * - request.log: HTTP 请求日志
 *
 * 配置项：
 * - LOG_DIR: 日志目录路径，默认为 {cwd}/logs
 *
 * 日志轮转：
 * - 单文件最大 10MB
 * - 保留最近 5 个备份文件
 * - 使用同步方式轮转，避免并发问题
 *
 * 安全特性：
 * - writeToFile 使用异步版本，不阻塞事件循环
 * - 支持日志上下文信息（userId, ip, userAgent 等）
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  userId?: string;
  ip?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  requestId?: string;
  // 修复 B-QUAL-011：限制索引签名类型，避免任意键值
  [key: string]: string | number | undefined;
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logDir: string;
  private readonly currentLogFile: string;
  private readonly errorLogFile: string;
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private readonly maxBackupFiles: number = 5;

  constructor(private readonly configService: ConfigService) {
    this.logDir = this.configService.get('LOG_DIR') || path.join(process.cwd(), 'logs');
    this.ensureLogDir();
    this.currentLogFile = path.join(this.logDir, 'app.log');
    this.errorLogFile = path.join(this.logDir, 'error.log');
  }

  private ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(
    level: LogLevel,
    message: any,
    context?: string,
    trace?: string,
    logContext?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    const traceStr = trace ? `\n${trace}` : '';
    const extraStr = logContext ? `\n  Context: ${JSON.stringify(logContext)}` : '';

    return `${timestamp}${contextStr} ${level.toUpperCase()}: ${message}${extraStr}${traceStr}\n`;
  }

  /**
   * 写入日志文件
   * 安全修复：改用异步版本避免阻塞事件循环
   */
  private async writeToFile(filePath: string, content: string) {
    await this.checkFileSize(filePath);
    return new Promise<void>((resolve, reject) => {
      fs.appendFile(filePath, content, 'utf8', (err) => {
        if (err) {
          console.error('Failed to write log file:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 检查文件大小，必要时轮转（同步版本，仅在初始化时使用）
   */
  private checkFileSizeSync(filePath: string) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size >= this.maxFileSize) {
      this.rotateLogFile(filePath);
    }
  }

  /**
   * 检查文件大小，必要时轮转（异步版本）
   */
  private async checkFileSize(filePath: string) {
    return new Promise<void>((resolve) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          // 文件不存在，无需轮转
          resolve();
          return;
        }
        if (stats.size >= this.maxFileSize) {
          this.rotateLogFile(filePath);
        }
        resolve();
      });
    });
  }

  /**
   * 轮转日志文件
   */
  private rotateLogFile(filePath: string) {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);

    // 删除最旧的备份
    const oldestBackup = path.join(dir, `${base}.${this.maxBackupFiles}${ext}`);
    if (fs.existsSync(oldestBackup)) {
      fs.unlinkSync(oldestBackup);
    }

    // 重命名现有备份
    for (let i = this.maxBackupFiles - 1; i >= 1; i--) {
      const oldPath = path.join(dir, `${base}.${i}${ext}`);
      const newPath = path.join(dir, `${base}.${i + 1}${ext}`);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    }

    // 重命名当前日志文件
    const backupPath = path.join(dir, `${base}.1${ext}`);
    fs.renameSync(filePath, backupPath);
  }

  /**
   * 记录错误日志
   */
  error(message: any, trace?: string, context?: string, logContext?: LogContext) {
    const formatted = this.formatMessage(LogLevel.ERROR, message, context, trace, logContext);
    console.error(formatted.trim());
    // 异步写入，fire and forget 模式
    this.writeToFile(this.errorLogFile, formatted).catch(() => {});
    this.writeToFile(this.currentLogFile, formatted).catch(() => {});
  }

  /**
   * 记录警告日志
   */
  warn(message: any, context?: string, logContext?: LogContext) {
    const formatted = this.formatMessage(LogLevel.WARN, message, context, undefined, logContext);
    console.warn(formatted.trim());
    this.writeToFile(this.currentLogFile, formatted).catch(() => {});
  }

  /**
   * 记录信息日志
   */
  log(message: any, context?: string, logContext?: LogContext) {
    const formatted = this.formatMessage(LogLevel.INFO, message, context, undefined, logContext);
    console.log(formatted.trim());
    this.writeToFile(this.currentLogFile, formatted).catch(() => {});
  }

  /**
   * 记录调试日志
   */
  debug?(message: any, context?: string, logContext?: LogContext) {
    if (this.configService.get('NODE_ENV') === 'development') {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, context, undefined, logContext);
      console.debug(formatted.trim());
      this.writeToFile(this.currentLogFile, formatted).catch(() => {});
    }
  }

  /**
   * 记录详细日志
   */
  verbose?(message: any, context?: string, logContext?: LogContext) {
    if (this.configService.get('NODE_ENV') === 'development') {
      const formatted = this.formatMessage(LogLevel.VERBOSE, message, context, undefined, logContext);
      console.log(formatted.trim());
      this.writeToFile(this.currentLogFile, formatted).catch(() => {});
    }
  }

  /**
   * 记录业务日志
   */
  business(action: string, details: any, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'business',
      action,
      details,
      ...context,
    };
    const formatted = JSON.stringify(logEntry) + '\n';

    const businessLogFile = path.join(this.logDir, 'business.log');
    this.writeToFile(businessLogFile, formatted).catch(() => {});
  }

  /**
   * 记录请求日志
   */
  request(req: any, res: any, duration: number) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'request',
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    const formatted = JSON.stringify(logEntry) + '\n';
    const requestLogFile = path.join(this.logDir, 'request.log');
    this.writeToFile(requestLogFile, formatted).catch(() => {});

    // 开发环境也输出到控制台
    if (this.configService.get('NODE_ENV') === 'development') {
      console.log(
        `${logEntry.timestamp} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
      );
    }
  }
}
