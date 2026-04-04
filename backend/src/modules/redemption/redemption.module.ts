import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedemptionController } from './redemption.controller';
import { RedemptionService } from './redemption.service';
import { RedemptionOrder, Adoption, Livestock } from '@/entities';
import { RedisService } from '@/common/utils/redis.service';
import { AdoptionModule } from '../adoption/adoption.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RedemptionOrder, Adoption, Livestock]),
    AdoptionModule,
    PaymentModule,
  ],
  controllers: [RedemptionController],
  providers: [RedemptionService, RedisService],
  exports: [RedemptionService],
})
export class RedemptionModule {}
