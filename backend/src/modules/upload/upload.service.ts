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
  private uploadDir: string;
  private baseUrl: string;
  private allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private allowedDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  private maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get('APP_URL') || 'http://localhost:3001';
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
    const sanitizedSubDir = subDir ? subDir.replaceAll('..', '').replaceAll(/[\/\\]/g, '') : undefined;

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
   */
  private validateFile(file: Express.Multer.File, allowedTypes: string[]) {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`文件大小超过限制: ${this.maxFileSize / 1024 / 1024}MB`);
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
