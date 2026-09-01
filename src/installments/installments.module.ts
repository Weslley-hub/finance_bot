import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { InstallmentsService } from './installments.service';

@Module({
  imports: [CardsModule, TransactionsModule],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
