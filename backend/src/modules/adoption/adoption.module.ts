import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdoptionController } from './adoption.controller';
import { AdoptionService } from './adoption.service';
import { Adoption, FeedBill, Order } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Adoption, FeedBill, Order])],
  controllers: [AdoptionController],
  providers: [AdoptionService, RedisService],
  exports: [AdoptionService],
})
export class AdoptionModule {}
