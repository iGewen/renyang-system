import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import type { StringValue } from 'ms';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10,
      },
    }),
    // 安全修复 (B-H11): 添加 JwtModule 用于签名 URL
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        const expiresIn = (configService.get<string>('jwt.expiresIn') || '2h') as StringValue;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
