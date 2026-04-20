import { IsString, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendSmsCodeDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '验证码类型', enum: ['register', 'login', 'reset_password'], example: 'register' })
  @IsString()
  @IsNotEmpty({ message: '类型不能为空' })
  @Matches(/^(register|login|reset_password)$/, { message: '类型不正确' })
  type: string;

  @ApiPropertyOptional({ description: '客户端IP（由服务器注入，非前端传递）' })
  @IsString()
  @IsOptional()
  clientIp?: string;
}

// 密码强度正则：至少包含大小写字母和数字，8-20位
const PWD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,20}$/;
const PWD_VALIDATION_MSG = '密码必须包含大小写字母和数字，长度8-20位，可包含特殊字符@$!%*?&';

export class RegisterDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码为6位' })
  code: string;

  @ApiProperty({ description: '密码', example: 'Password123' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @Matches(PWD_PATTERN, { message: PWD_VALIDATION_MSG })
  password: string;

  @ApiPropertyOptional({ description: '邀请码' })
  @IsString()
  @IsOptional()
  inviteCode?: string;
}

export class LoginByPasswordDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '密码', example: 'Password123' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

export class LoginByCodeDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码为6位' })
  code: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码为6位' })
  code: string;

  @ApiProperty({ description: '新密码', example: 'NewPassword123' })
  @IsString()
  @IsNotEmpty({ message: '新密码不能为空' })
  @Matches(PWD_PATTERN, { message: PWD_VALIDATION_MSG })
  newPassword: string;
}

export class BindPhoneDto {
  @ApiProperty({ description: '微信临时token' })
  @IsString()
  @IsNotEmpty({ message: '临时token不能为空' })
  tempToken: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsString()
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: '验证码不能为空' })
  @Length(6, 6, { message: '验证码为6位' })
  code: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsString()
  @IsOptional()
  @Length(1, 50, { message: '昵称长度为1-50位' })
  nickname?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  @IsString()
  @IsOptional()
  // 安全修复 B-SEC-017：头像URL格式验证
  @Matches(/^https?:\/\/.+\..+/, { message: '头像必须是有效的HTTP(S) URL格式' })
  avatar?: string;
}
