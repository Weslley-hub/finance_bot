import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { GoalsService } from './goals.service';

@Module({
  imports: [ReportsModule],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
