import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { User, BalanceLog, PaymentRecord, Adoption, FeedBill, RedemptionOrder, RefundOrder } from '@/entities';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BalanceLog, PaymentRecord, Adoption, FeedBill, RedemptionOrder, RefundOrder]),
    OrderModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}