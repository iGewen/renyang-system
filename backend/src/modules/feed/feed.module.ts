import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedBill, Adoption, Admin } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeedBill, Adoption, Admin])],
  controllers: [FeedController],
  providers: [FeedService, RedisService],
  exports: [FeedService],
})
export class FeedModule {}
