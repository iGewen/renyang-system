import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn } from 'class-validator';

// =============== 认证相关 DTO ===============

export class LoginDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '原密码' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  newPassword: string;
}

// =============== 活体类型相关 DTO ===============

export class CreateLivestockTypeDto {
  @ApiProperty({ description: '类型名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLivestockTypeDto {
  @ApiPropertyOptional({ description: '类型名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// =============== 活体相关 DTO ===============

export class CreateLivestockDto {
  @ApiProperty({ description: '活体名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '类型ID' })
  @IsString()
  typeId: string;

  @ApiProperty({ description: '价格' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: '月饲料费' })
  @IsNumber()
  monthlyFeedFee: number;

  @ApiProperty({ description: '买断所需月数' })
  @IsNumber()
  redemptionMonths: number;

  @ApiPropertyOptional({ description: '图片列表', type: [String] })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: '主图URL' })
  @IsString()
  @IsOptional()
  mainImage?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '库存' })
  @IsNumber()
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: '是否上架' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLivestockDto {
  @ApiPropertyOptional({ description: '活体名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '类型ID' })
  @IsString()
  @IsOptional()
  typeId?: string;

  @ApiPropertyOptional({ description: '价格' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: '月饲料费' })
  @IsNumber()
  @IsOptional()
  monthlyFeedFee?: number;

  @ApiPropertyOptional({ description: '买断所需月数' })
  @IsNumber()
  @IsOptional()
  redemptionMonths?: number;

  @ApiPropertyOptional({ description: '图片列表', type: [String] })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: '主图URL' })
  @IsString()
  @IsOptional()
  mainImage?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '库存' })
  @IsNumber()
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: '是否上架' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// =============== 系统配置相关 DTO ===============

export class UpdateSystemConfigDto {
  @ApiProperty({ description: '配置键' })
  @IsString()
  configKey: string;

  @ApiProperty({ description: '配置值' })
  @IsOptional()
  configValue: any;
}

// =============== 公告相关 DTO ===============

export class SendAnnouncementDto {
  @ApiProperty({ description: '公告标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '公告内容' })
  @IsString()
  content: string;
}

// =============== 协议相关 DTO ===============

export class SaveAgreementDto {
  @ApiProperty({ description: '协议键名' })
  @IsString()
  agreementKey: string;

  @ApiProperty({ description: '协议标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '协议内容' })
  @IsString()
  content: string;
}

// =============== 管理员相关 DTO ===============

export class CreateAdminDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: '姓名' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: '角色：1超级管理员 2普通管理员', enum: [1, 2] })
  @IsNumber()
  @IsIn([1, 2])
  role: number;
}

// =============== 用户管理相关 DTO ===============

export class UpdateUserStatusDto {
  @ApiProperty({ description: '用户状态' })
  @IsNumber()
  status: number;
}

export class AdjustBalanceDto {
  @ApiProperty({ description: '调整金额（正数增加，负数减少）' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: '调整原因' })
  @IsString()
  reason: string;
}

export class UpdateUserInfoDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsString()
  @IsOptional()
  phone?: string;
}

// =============== 通知相关 DTO ===============

export class SendNotificationDto {
  @ApiPropertyOptional({ description: '目标用户ID列表（为空则发送给所有用户）', type: [String] })
  @IsOptional()
  userIds?: string[];

  @ApiProperty({ description: '通知标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '通知内容' })
  @IsString()
  content: string;

  @ApiProperty({ description: '通知类型', enum: ['system', 'order', 'feed', 'redemption', 'balance'] })
  @IsString()
  @IsIn(['system', 'order', 'feed', 'redemption', 'balance'])
  type: string;
}

// =============== 审核相关 DTO ===============

export class AuditRedemptionDto {
  @ApiProperty({ description: '是否通过' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: '调整后金额' })
  @IsNumber()
  @IsOptional()
  adjustedAmount?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;
}

export class AuditRefundDto {
  @ApiProperty({ description: '是否通过' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;
}

// =============== 活体状态相关 DTO ===============

export class UpdateLivestockStatusDto {
  @ApiProperty({ description: '状态：1上架 2下架' })
  @IsNumber()
  status: number;
}
