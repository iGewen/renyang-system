import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from '@/entities/user.entity';
import { BalanceLog } from '@/entities/balance-log.entity';
import { SystemConfig } from '@/entities/system-config.entity';
import { Adoption } from '@/entities/adoption.entity';
import { SmsCode } from '@/entities/sms-code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, BalanceLog, SystemConfig, Adoption, SmsCode])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
