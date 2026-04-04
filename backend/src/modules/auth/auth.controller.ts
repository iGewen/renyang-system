import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
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
  constructor(private readonly authService: AuthService) {}

  /**
   * 发送短信验证码
   */
  @Public()
  @Post('sms/send')
  @ApiOperation({ summary: '发送短信验证码' })
  @ApiResponse({ status: 200, description: '发送成功' })
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
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
   */
  @Public()
  @Get('wechat/callback')
  @ApiOperation({ summary: '微信授权回调' })
  @ApiResponse({ status: 200, description: '授权成功' })
  async wechatCallback(@Body('code') code: string, @Body('state') state: string) {
    return this.authService.wechatCallback(code, state);
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
