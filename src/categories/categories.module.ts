import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CategoriesService } from './categories.service';
import { CategorizationEngine } from './categorization.engine';

@Module({
  imports: [AiModule],
  providers: [CategoriesService, CategorizationEngine],
  exports: [CategoriesService, CategorizationEngine],
})
export class CategoriesModule {}
