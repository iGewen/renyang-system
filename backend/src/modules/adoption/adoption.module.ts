import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdoptionController } from './adoption.controller';
import { AdoptionService } from './adoption.service';
import { Adoption, FeedBill } from '@/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Adoption, FeedBill])],
  controllers: [AdoptionController],
  providers: [AdoptionService],
  exports: [AdoptionService],
})
export class AdoptionModule {}
