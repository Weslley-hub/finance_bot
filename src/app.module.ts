import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BillsModule } from './bills/bills.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CardsModule } from './cards/cards.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { validateEnv } from './common/config/env.validation';
import { DocumentsModule } from './documents/documents.module';
import { FamiliesModule } from './families/families.module';
import { GoalsModule } from './goals/goals.module';
import { InstallmentsModule } from './installments/installments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RecurringModule } from './recurring/recurring.module';
import { ReportsModule } from './reports/reports.module';
import { TelegramModule } from './telegram/telegram.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    CommonModule,
    TelegramModule,
    UsersModule,
    FamiliesModule,
    TransactionsModule,
    CategoriesModule,
    AccountsModule,
    CardsModule,
    BillsModule,
    RecurringModule,
    InstallmentsModule,
    BudgetsModule,
    GoalsModule,
    ReportsModule,
    DocumentsModule,
    AiModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
