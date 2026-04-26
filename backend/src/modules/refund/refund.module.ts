import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RefundOrder, Order, Adoption } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefundOrder, Order, Adoption]),
  ],
  controllers: [RefundController],
  providers: [RefundService, RedisService],
  exports: [RefundService],
})
export class RefundModule {}
