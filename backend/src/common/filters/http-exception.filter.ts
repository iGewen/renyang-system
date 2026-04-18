import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// 错误消息中英文映射
const errorMessageMap: Record<string, string> = {
  // 通用验证错误
  'property .* should not exist': '请求参数包含无效字段',
  'must be a string': '必须是字符串类型',
  'must be a number': '必须是数字类型',
  'must be a boolean': '必须是布尔类型',
  'must be an object': '必须是一个对象',
  'must be an array': '必须是数组类型',
  'should not be empty': '不能为空',
  'is required': '是必填项',
  'must be a valid email': '请输入有效的邮箱地址',
  'must be a valid phone': '请输入有效的手机号',
  'must be longer than': '长度不能少于',
  'must be shorter than': '长度不能超过',
  'must contain': '必须包含',

  // 认证相关
  'Unauthorized': '未授权，请先登录',
  'Invalid credentials': '用户名或密码错误',
  'Invalid password': '密码错误',
  'User not found': '用户不存在',
  'Token expired': '登录已过期，请重新登录',
  'Invalid token': '无效的登录凭证',
  'Account disabled': '账户已被禁用',
  'Account banned': '账户已被封禁',

  // 资源相关
  'Not Found': '资源不存在',
  'Already exists': '资源已存在',
  'Conflict': '资源冲突',

  // 操作相关
  'Forbidden': '没有权限执行此操作',
  'Bad Request': '请求参数错误',
  'Internal Server Error': '服务器内部错误',
  'Service Unavailable': '服务暂时不可用',
  'Too Many Requests': '请求过于频繁，请稍后再试',

  // 数据库相关
  'Duplicate entry': '数据已存在',
  'Foreign key constraint': '关联数据不存在',
  'Data too long': '数据长度超出限制',

  // 文件相关
  'File too large': '文件大小超出限制',
  'Invalid file type': '不支持的文件类型',
  'No file uploaded': '请上传文件',

  // 支付相关
  'Payment failed': '支付失败',
  'Order not found': '订单不存在',
  'Order expired': '订单已过期',
  'Order paid': '订单已支付',
  'Order cancelled': '订单已取消',

  // 短信相关
  'SMS send failed': '短信发送失败',
  'Invalid code': '验证码错误',
  'Code expired': '验证码已过期',
  'Code too frequent': '验证码发送过于频繁，请稍后再试',
};

// 匹配中文错误信息
function translateMessage(message: string): string {
  // 如果已经是中文，直接返回
  if (/[\u4e00-\u9fa5]/.test(message)) {
    return message;
  }

  // 尝试匹配映射表中的模式
  for (const [pattern, chinese] of Object.entries(errorMessageMap)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(message)) {
      return chinese;
    }
  }

  // 默认错误信息
  return '操作失败，请稍后重试';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = -1;

    if (exception instanceof BadRequestException) {
      status = HttpStatus.BAD_REQUEST;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;

        // 处理 class-validator 的验证错误
        if (res.message && Array.isArray(res.message)) {
          // 提取并翻译所有验证错误
          const messages = res.message.map((msg: string) => translateMessage(msg));
          message = messages[0]; // 只返回第一个错误
        } else if (res.message) {
          message = translateMessage(res.message);
        } else {
          message = '请求参数错误';
        }
        code = res.code || 400;
      } else {
        message = '请求参数错误';
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as any;
        message = translateMessage(res.message || exception.message);
        code = res.code || status;
      } else {
        message = translateMessage(exception.message);
      }
    } else if (exception instanceof Error) {
      message = translateMessage(exception.message);
      this.logger.error('Unhandled exception', exception.stack);
    }

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} - ${status}: ${message}`);
    }

    response.status(status).json({
      code,
      message,
      data: null,
      timestamp: Date.now(),
      path: request.url,
    });
  }
}
