import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LivestockController } from './livestock.controller';
import { LivestockService } from './livestock.service';
import { Livestock, LivestockType } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Livestock, LivestockType])],
  controllers: [LivestockController],
  providers: [LivestockService, RedisService],
  exports: [LivestockService],
})
export class LivestockModule {}
