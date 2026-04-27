import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { User, BalanceLog, PaymentRecord, Order, Adoption, FeedBill, RedemptionOrder, RefundOrder } from '@/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, BalanceLog, PaymentRecord, Order, Adoption, FeedBill, RedemptionOrder, RefundOrder])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}