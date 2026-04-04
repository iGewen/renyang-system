import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

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
  [key: string]: any;
}

@Injectable()
export class AppLogger implements LoggerService {
  private logDir: string;
  private currentLogFile: string;
  private errorLogFile: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxBackupFiles: number = 5;

  constructor(private configService: ConfigService) {
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
   */
  private writeToFile(filePath: string, content: string) {
    this.checkFileSize(filePath);
    fs.appendFileSync(filePath, content, 'utf8');
  }

  /**
   * 检查文件大小，必要时轮转
   */
  private checkFileSize(filePath: string) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size >= this.maxFileSize) {
      this.rotateLogFile(filePath);
    }
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
    this.writeToFile(this.errorLogFile, formatted);
    this.writeToFile(this.currentLogFile, formatted);
  }

  /**
   * 记录警告日志
   */
  warn(message: any, context?: string, logContext?: LogContext) {
    const formatted = this.formatMessage(LogLevel.WARN, message, context, undefined, logContext);
    console.warn(formatted.trim());
    this.writeToFile(this.currentLogFile, formatted);
  }

  /**
   * 记录信息日志
   */
  log(message: any, context?: string, logContext?: LogContext) {
    const formatted = this.formatMessage(LogLevel.INFO, message, context, undefined, logContext);
    console.log(formatted.trim());
    this.writeToFile(this.currentLogFile, formatted);
  }

  /**
   * 记录调试日志
   */
  debug?(message: any, context?: string, logContext?: LogContext) {
    if (this.configService.get('NODE_ENV') === 'development') {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, context, undefined, logContext);
      console.debug(formatted.trim());
      this.writeToFile(this.currentLogFile, formatted);
    }
  }

  /**
   * 记录详细日志
   */
  verbose?(message: any, context?: string, logContext?: LogContext) {
    if (this.configService.get('NODE_ENV') === 'development') {
      const formatted = this.formatMessage(LogLevel.VERBOSE, message, context, undefined, logContext);
      console.log(formatted.trim());
      this.writeToFile(this.currentLogFile, formatted);
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
    this.writeToFile(businessLogFile, formatted);
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
    this.writeToFile(requestLogFile, formatted);

    // 开发环境也输出到控制台
    if (this.configService.get('NODE_ENV') === 'development') {
      console.log(
        `${logEntry.timestamp} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
      );
    }
  }
}
