import { Module } from '@nestjs/common';
import { RecurringService } from './recurring.service';

@Module({
  providers: [RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
