import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { AiModule } from '../ai/ai.module';
import { BillsModule } from '../bills/bills.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { CardsModule } from '../cards/cards.module';
import { CategoriesModule } from '../categories/categories.module';
import { GoalsModule } from '../goals/goals.module';
import { isSecretConfigured } from '../common/config/env.validation';
import { ReportsModule } from '../reports/reports.module';
import { RecurringModule } from '../recurring/recurring.module';
import { InstallmentsModule } from '../installments/installments.module';
import { DocumentsModule } from '../documents/documents.module';
import { FamiliesModule } from '../families/families.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { PendingMovementsStore } from './pending-movements.store';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

const logger = new Logger('TelegramModule');

@Module({
  imports: [
    FamiliesModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    BillsModule,
    RecurringModule,
    InstallmentsModule,
    ReportsModule,
    BudgetsModule,
    GoalsModule,
    CardsModule,
    DocumentsModule,
    AiModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('TELEGRAM_BOT_TOKEN');

        if (!isSecretConfigured(token) || !token) {
          logger.warn(
            'TELEGRAM_BOT_TOKEN não configurado. Crie o bot no @BotFather e coloque o token no .env. O polling fica desligado.',
          );

          return {
            token: '0:disabled',
            launchOptions: false as const,
          };
        }

        return { token };
      },
    }),
  ],
  providers: [TelegramService, TelegramUpdate, PendingMovementsStore],
  exports: [TelegramService],
})
export class TelegramModule {}
