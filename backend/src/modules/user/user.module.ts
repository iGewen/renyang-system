import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from '@/entities/user.entity';
import { BalanceLog } from '@/entities/balance-log.entity';
import { SystemConfig } from '@/entities/system-config.entity';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, BalanceLog, SystemConfig])],
  controllers: [UserController],
  providers: [UserService, RedisService],
  exports: [UserService],
})
export class UserModule {}
