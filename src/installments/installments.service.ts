import { Injectable } from '@nestjs/common';
import { CategorizationSource, Prisma } from '@prisma/client';
import { CardsService } from '../cards/cards.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { dueDateOn } from '../recurring/recurring-schedule';
import { TransactionsService } from '../transactions/transactions.service';
import { shiftMonth, splitInstallments } from './installment-split';

const planWithDetails = {
  card: true,
  category: { include: { parent: true } },
  installments: { orderBy: { number: 'asc' as const } },
} as const;

@Injectable()
export class InstallmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly transactions: TransactionsService,
  ) {}

  async createPlan(data: {
    familyId: string;
    userId: string;
    categoryId: string;
    description: string;
    merchant?: string;
    rawText?: string;
    totalAmount: number;
    installmentCount: number;
    cardName?: string | null;
    source?: CategorizationSource;
  }) {
    const amounts = splitInstallments(data.totalAmount, data.installmentCount);
    const card = data.cardName
      ? await this.cards.upsert(data.familyId, data.cardName)
      : null;
    const start = new Date();
    const startMonth = start.getMonth() + 1;
    const startYear = start.getFullYear();
    const day = start.getDate();

    const plan = await this.prisma.installmentPlan.create({
      data: {
        familyId: data.familyId,
        userId: data.userId,
        cardId: card?.id,
        categoryId: data.categoryId,
        description: data.description,
        merchant: data.merchant ?? data.cardName,
        rawText: data.rawText,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        installmentCount: data.installmentCount,
        installmentAmount: new Prisma.Decimal(amounts[0]),
        source: data.source ?? 'MANUAL',
        installments: {
          create: amounts.map((amount, index) => {
            const when = shiftMonth(startYear, startMonth, index);
            return {
              number: index + 1,
              amount: new Prisma.Decimal(amount),
              referenceMonth: when.month,
              referenceYear: when.year,
              dueDate: dueDateOn(when.year, when.month, day),
              status: 'PENDING',
            };
          }),
        },
      },
      include: planWithDetails,
    });

    await this.materializeDue(data.familyId);
    return this.prisma.installmentPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: planWithDetails,
    });
  }

  async materializeDue(familyId: string, from = new Date()): Promise<void> {
    const month = from.getMonth() + 1;
    const year = from.getFullYear();
    const due = await this.prisma.installment.findMany({
      where: {
        status: 'PENDING',
        transactionId: null,
        plan: { familyId },
        OR: [
          { referenceYear: { lt: year } },
          { referenceYear: year, referenceMonth: { lte: month } },
        ],
      },
      include: { plan: true },
    });

    for (const item of due) {
      const saved = await this.transactions.create({
        familyId: item.plan.familyId,
        userId: item.plan.userId,
        type: 'EXPENSE',
        amount: Number(item.amount),
        description: `${item.plan.description} ${item.number}/${item.plan.installmentCount}`,
        merchant: item.plan.merchant ?? undefined,
        rawText: item.plan.rawText ?? undefined,
        categoryId: item.plan.categoryId,
        source: 'TEXT',
        categorizationSource: item.plan.source,
        transactionDate: item.dueDate ?? new Date(item.referenceYear, item.referenceMonth - 1, 1),
        creditCardId: item.plan.cardId ?? undefined,
      });

      await this.prisma.installment.update({
        where: { id: item.id },
        data: { status: 'PAID', transactionId: saved.id },
      });
    }
  }
}
