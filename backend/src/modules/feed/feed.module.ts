import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedBill, Adoption, Admin } from '@/entities';

@Module({
  imports: [TypeOrmModule.forFeature([FeedBill, Adoption, Admin])],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
