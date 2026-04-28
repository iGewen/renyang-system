import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RefundOrder, Adoption } from '@/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefundOrder, Adoption]),
  ],
  controllers: [RefundController],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}
