import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { UploadService } from './upload.service';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'node:path';

class DeleteFileDto {
  @ApiProperty({ description: '文件名' })
  @IsString()
  filename: string;

  @ApiPropertyOptional({ description: '子目录', enum: ['images', 'documents', 'avatars'] })
  @IsString()
  @IsOptional()
  subDir?: string;
}

@ApiTags('文件上传')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 上传单个图片
   */
  @Post('image')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传单个图片' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('subDir') subDir?: string,
  ) {
    return this.uploadService.uploadImage(file, subDir || 'images');
  }

  /**
   * 批量上传图片
   */
  @Post('images')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '批量上传图片（最多10张）' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('subDir') subDir?: string,
  ) {
    return this.uploadService.uploadImages(files, subDir || 'images');
  }

  /**
   * 上传头像
   */
  @Post('avatar')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传用户头像' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file, 'avatars');
  }

  /**
   * 上传文档
   */
  @Post('document')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档' })
  @ApiResponse({ status: 200, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('subDir') subDir?: string,
  ) {
    return this.uploadService.uploadDocument(file, subDir || 'documents');
  }

  /**
   * 删除文件
   */
  @Delete()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteFile(@Body() dto: DeleteFileDto) {
    const result = await this.uploadService.deleteFile(dto.filename, dto.subDir);
    return { success: result };
  }

  /**
   * 检查文件是否存在
   */
  @Get('exists/:filename')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '检查文件是否存在' })
  @ApiResponse({ status: 200, description: '返回文件存在状态' })
  async fileExists(
    @Param('filename') filename: string,
    @Body('subDir') subDir?: string,
  ) {
    const exists = this.uploadService.fileExists(filename, subDir);
    return { exists };
  }

  /**
   * 获取文件信息
   */
  @Get('info/:filename')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取文件信息' })
  @ApiResponse({ status: 200, description: '返回文件信息' })
  async getFileInfo(
    @Param('filename') filename: string,
    @Body('subDir') subDir?: string,
  ) {
    const info = this.uploadService.getFileInfo(filename, subDir);
    return info || { message: '文件不存在' };
  }

  // ==================== 安全修复 (B-H11): 上传文件签名 URL ====================

  /**
   * 获取签名文件 URL
   * 生成一个 5 分钟有效的签名 URL，用于安全访问上传的文件
   */
  @Get('signed-url')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取签名文件 URL' })
  @ApiResponse({ status: 200, description: '返回签名 URL' })
  async getSignedUrl(
    @Query('file') filename: string,
    @Req() req: Request,
  ) {
    // 安全检查：防止路径遍历攻击
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('无效的文件名');
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new BadRequestException('用户未登录');
    }

    // 生成 5 分钟有效的签名 token
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) {
      throw new BadRequestException('服务配置错误');
    }

    const token = this.jwtService.sign(
      { file: filename, userId, iat: Date.now() },
      { secret, expiresIn: '5m' }
    );

    return { url: `/upload/verify?token=${token}` };
  }

  /**
   * 验证签名并返回文件
   * 通过签名 URL 安全访问上传的文件
   */
  @Get('verify')
  @ApiOperation({ summary: '验证签名并返回文件' })
  @ApiResponse({ status: 200, description: '返回文件内容' })
  @ApiResponse({ status: 403, description: '签名无效或已过期' })
  async verifyAndServe(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return res.status(403).json({ message: '缺少访问令牌' });
    }

    try {
      const secret = this.configService.get<string>('jwt.secret');
      if (!secret) {
        return res.status(500).json({ message: '服务配置错误' });
      }

      const payload = this.jwtService.verify(token, { secret });

      // 安全检查：确保文件名有效
      const filename = payload.file;
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(403).json({ message: '无效的文件名' });
      }

      // 构建文件路径
      const uploadsDir = join(process.cwd(), 'uploads');
      const filePath = join(uploadsDir, filename);

      // 安全检查：确保路径在 uploads 目录内
      const resolvedPath = resolve(filePath);
      if (!resolvedPath.startsWith(resolve(uploadsDir))) {
        return res.status(403).json({ message: '非法路径' });
      }

      // 发送文件
      return res.sendFile(resolvedPath, (err) => {
        if (err) {
          return res.status(404).json({ message: '文件不存在' });
        }
      });
    } catch (error) {
      // 处理签名验证失败的情况
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(`文件访问失败: ${errorMessage}`);
      return res.status(403).json({ message: '链接已过期或无效' });
    }
  }
}
