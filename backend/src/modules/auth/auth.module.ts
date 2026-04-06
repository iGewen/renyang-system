import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '@/entities/user.entity';
import { SmsCode } from '@/entities/sms-code.entity';
import { SystemConfig } from '@/entities/system-config.entity';
import { RedisService } from '@/common/utils/redis.service';
import { SmsService } from '@/services/sms.service';
import { UserStatusGuard } from '@/common/guards/user-status.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, SmsCode, SystemConfig]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RedisService, SmsService, UserStatusGuard],
  exports: [AuthService, JwtStrategy, UserStatusGuard],
})
export class AuthModule {}
