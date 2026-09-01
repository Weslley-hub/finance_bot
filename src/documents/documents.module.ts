import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { DocumentPipelineService } from './document-pipeline.service';
import { DocumentsService } from './documents.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [AiModule, CategoriesModule, TransactionsModule],
  providers: [DocumentsService, PdfService, DocumentPipelineService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
