import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Request,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RedisService } from '@/common/utils/redis.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  SendSmsCodeDto,
  RegisterDto,
  LoginByPasswordDto,
  LoginByCodeDto,
  ResetPasswordDto,
  BindPhoneDto,
  UpdateUserDto,
} from './dto/auth.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly redisService: RedisService, private readonly configService: ConfigService) {}

  /**
   * 发送短信验证码
   * 安全修复：提取客户端IP用于安全审计和防刷
   */
  @Public()
  @Post('sms/send')
  @ApiOperation({ summary: '发送短信验证码' })
  @ApiResponse({ status: 200, description: '发送成功' })
  async sendSmsCode(@Body() dto: SendSmsCodeDto, @Request() req: any) {
    // 安全修复：从请求中提取客户端IP
    dto.clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    return this.authService.sendSmsCode(dto);
  }

  /**
   * 用户注册
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * 密码登录
   */
  @Public()
  @Post('login/password')
  @ApiOperation({ summary: '密码登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  async loginByPassword(@Body() dto: LoginByPasswordDto) {
    return this.authService.loginByPassword(dto);
  }

  /**
   * 验证码登录
   */
  @Public()
  @Post('login/code')
  @ApiOperation({ summary: '验证码登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  async loginByCode(@Body() dto: LoginByCodeDto) {
    return this.authService.loginByCode(dto);
  }

  /**
   * 重置密码
   */
  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: '重置密码' })
  @ApiResponse({ status: 200, description: '重置成功' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * 获取微信授权URL
   */
  @Public()
  @Get('wechat/url')
  @ApiOperation({ summary: '获取微信授权URL' })
  @ApiResponse({ status: 200, description: '返回微信授权URL' })
  async getWechatAuthUrl() {
    return this.authService.getWechatAuthUrl();
  }

  /**
   * 微信授权回调
   * 安全修复：GET 请求没有 Body，改用 @Query 参数
   */
  @Public()
  @Get('wechat/callback')
  @ApiOperation({ summary: '微信授权回调' })
  async wechatCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    const result = await this.authService.wechatCallback(code, state);
    // 生成临时交换key，避免token直接暴露在URL中
    const exchangeKey = crypto.randomBytes(24).toString('hex');
    await this.redisService.set(`wechat:exchange:${exchangeKey}`, JSON.stringify(result), 300);
    // 重定向到前端，带上交换key
    const appUrl = this.configService.get('app.url') || 'https://ry.yunong.icu';
    return res.redirect(`${appUrl}/auth?wechat_key=${exchangeKey}`);
  }

  @Get('wechat/exchange')
  @ApiOperation({ summary: '微信登录交换token' })
  async exchangeWechatToken(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('无效的交换key');
    }
    const data = await this.redisService.get(`wechat:exchange:${key}`);
    if (!data) {
      throw new BadRequestException('交换key已过期或无效');
    }
    await this.redisService.del(`wechat:exchange:${key}`);
    return JSON.parse(data);
  }

  /**
   * 绑定手机号
   */
  @Public()
  @Post('wechat/bind-phone')
  @ApiOperation({ summary: '微信用户绑定手机号' })
  @ApiResponse({ status: 200, description: '绑定成功' })
  async bindPhone(@Body() dto: BindPhoneDto) {
    return this.authService.bindPhone(dto);
  }

  /**
   * 获取当前用户信息
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '返回用户信息' })
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  /**
   * 更新用户信息
   */
  @Put('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateUser(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(userId, dto);
  }
}
