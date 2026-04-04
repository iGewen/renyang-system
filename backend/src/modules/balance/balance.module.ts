import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { User, BalanceLog } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, BalanceLog])],
  controllers: [BalanceController],
  providers: [BalanceService, RedisService],
  exports: [BalanceService],
})
export class BalanceModule {}
