import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order, User, Livestock, Adoption } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { LivestockModule } from '../livestock/livestock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Livestock, Adoption]),
    LivestockModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, RedisService],
  exports: [OrderService],
})
export class OrderModule {}
