import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [ReportsModule],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
