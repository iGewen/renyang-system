import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
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
import { UploadService } from './upload.service';
import { IsString, IsOptional, IsIn } from 'class-validator';

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
  constructor(private readonly uploadService: UploadService) {}

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
}
