import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface UploadResult {
  url: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly allowedDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    this.ensureUploadDir();
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 生成唯一文件名
   */
  private generateFilename(originalname: string): string {
    const ext = path.extname(originalname);
    const hash = crypto.randomBytes(16).toString('hex');
    const date = new Date().toISOString().split('T')[0].replaceAll('-', '');
    return `${date}_${hash}${ext}`;
  }

  /**
   * 获取文件存储路径
   * 安全修复：防止路径遍历攻击
   */
  private getFilePath(filename: string, subDir?: string): string {
    // 防止路径遍历攻击
    const sanitizedFilename = path.basename(filename);
    const sanitizedSubDir = subDir ? subDir.replaceAll('..', '').replaceAll(/[/\\]/g, '') : undefined;

    const dir = sanitizedSubDir ? path.join(this.uploadDir, sanitizedSubDir) : this.uploadDir;

    // 确保目录路径在允许的上传目录内
    const resolvedDir = path.resolve(dir);
    if (!resolvedDir.startsWith(path.resolve(this.uploadDir))) {
      throw new Error('非法的目录路径');
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, sanitizedFilename);
    const resolvedPath = path.resolve(filePath);

    // 再次验证最终路径在上传目录内
    if (!resolvedPath.startsWith(path.resolve(this.uploadDir))) {
      throw new Error('非法的文件路径');
    }

    return filePath;
  }

  /**
   * 验证文件类型
   * 安全修复 S-06：添加文件头魔数验证，防止 MIME 类型伪造
   */
  private validateFile(file: Express.Multer.File, allowedTypes: string[]) {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`文件大小超过限制: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // 安全修复 S-06：检查文件扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(`不允许的文件扩展名: ${ext}`);
    }

    // 安全修复 S-06：检查文件头魔数（Magic Number）
    this.validateFileMagicNumber(file);
  }

  /**
   * 验证文件头魔数
   * 防止攻击者将恶意文件伪装成图片或文档
   */
  private validateFileMagicNumber(file: Express.Multer.File): void {
    const magicNumbers: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    };

    const expectedMagic = magicNumbers[file.mimetype];
    if (!expectedMagic || !file.buffer || file.buffer.length < expectedMagic.length) {
      // 如果没有定义魔数或文件太小，跳过检查（doc/docx 等格式复杂）
      return;
    }

    const header = Array.from(file.buffer.slice(0, expectedMagic.length));
    const isValid = header.every((byte, i) => byte === expectedMagic[i]);

    if (!isValid) {
      throw new BadRequestException('文件内容与声明的类型不符，可能存在安全风险');
    }
  }

  /**
   * 上传图片
   */
  async uploadImage(file: Express.Multer.File, subDir: string = 'images'): Promise<UploadResult> {
    this.validateFile(file, this.allowedImageTypes);

    const filename = this.generateFilename(file.originalname);
    const filePath = this.getFilePath(filename, subDir);

    // 写入文件
    fs.writeFileSync(filePath, file.buffer);

    // 构建URL
    const url = `${this.baseUrl}/uploads/${subDir}/${filename}`;

    return {
      url,
      filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * 上传文档
   */
  async uploadDocument(file: Express.Multer.File, subDir: string = 'documents'): Promise<UploadResult> {
    const allowedTypes = [...this.allowedImageTypes, ...this.allowedDocTypes];
    this.validateFile(file, allowedTypes);

    const filename = this.generateFilename(file.originalname);
    const filePath = this.getFilePath(filename, subDir);

    // 写入文件
    fs.writeFileSync(filePath, file.buffer);

    // 构建URL
    const url = `${this.baseUrl}/uploads/${subDir}/${filename}`;

    return {
      url,
      filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  /**
   * 批量上传图片
   */
  async uploadImages(files: Express.Multer.File[], subDir: string = 'images'): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadImage(file, subDir);
      results.push(result);
    }

    return results;
  }

  /**
   * 删除文件
   */
  async deleteFile(filename: string, subDir?: string): Promise<boolean> {
    const filePath = this.getFilePath(filename, subDir);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filename: string, subDir?: string): boolean {
    const filePath = this.getFilePath(filename, subDir);
    return fs.existsSync(filePath);
  }

  /**
   * 获取文件信息
   */
  getFileInfo(filename: string, subDir?: string): { size: number; createdAt: Date } | null {
    const filePath = this.getFilePath(filename, subDir);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
    };
  }
}
