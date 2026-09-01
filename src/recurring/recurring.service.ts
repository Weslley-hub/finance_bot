import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  dueDateOn,
  isDueOnOrAfterToday,
  nextDueOccurrence,
} from './recurring-schedule';

const withCategory = {
  category: { include: { parent: true } },
};

const listInclude = {
  category: { include: { parent: true } },
  bills: {
    where: { status: 'PENDING' as const },
    orderBy: [
      { referenceYear: Prisma.SortOrder.asc },
      { referenceMonth: Prisma.SortOrder.asc },
    ],
    take: 6,
    select: { referenceMonth: true, referenceYear: true },
  },
} satisfies Prisma.RecurringBillInclude;

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    familyId: string;
    userId: string;
    categoryId: string;
    supplier: string;
    amount: number;
    dayOfMonth: number;
  }) {
    const existing = await this.prisma.recurringBill.findFirst({
      where: {
        familyId: data.familyId,
        dayOfMonth: data.dayOfMonth,
        active: true,
        supplier: { equals: data.supplier, mode: 'insensitive' },
      },
      include: withCategory,
    });

    const saved = existing
      ? await this.prisma.recurringBill.update({
          where: { id: existing.id },
          data: {
            amount: new Prisma.Decimal(data.amount),
            categoryId: data.categoryId,
            userId: data.userId,
          },
          include: withCategory,
        })
      : await this.prisma.recurringBill.create({
          data: {
            familyId: data.familyId,
            userId: data.userId,
            categoryId: data.categoryId,
            supplier: data.supplier,
            amount: new Prisma.Decimal(data.amount),
            dayOfMonth: data.dayOfMonth,
          },
          include: withCategory,
        });

    await this.materializeNext(saved);
    return saved;
  }

  list(familyId: string) {
    return this.prisma.recurringBill.findMany({
      where: { familyId, active: true },
      include: listInclude,
      orderBy: { dayOfMonth: 'asc' },
    });
  }

  async materializeMonth(
    familyId: string,
    referenceMonth: number,
    referenceYear: number,
  ): Promise<void> {
    const recurrences = await this.prisma.recurringBill.findMany({
      where: { familyId, active: true },
    });

    for (const rec of recurrences) {
      const due = dueDateOn(referenceYear, referenceMonth, rec.dayOfMonth);
      if (!isDueOnOrAfterToday(due)) {
        continue;
      }

      await this.ensureBill(rec, referenceMonth, referenceYear);
    }
  }

  private async materializeNext(rec: {
    id: string;
    familyId: string;
    userId: string;
    categoryId: string;
    supplier: string;
    amount: Prisma.Decimal;
    dayOfMonth: number;
  }): Promise<void> {
    const next = nextDueOccurrence(rec.dayOfMonth);
    await this.ensureBill(rec, next.month, next.year);
  }

  private async ensureBill(
    rec: {
      id: string;
      familyId: string;
      userId: string;
      categoryId: string;
      supplier: string;
      amount: Prisma.Decimal;
      dayOfMonth: number;
    },
    referenceMonth: number,
    referenceYear: number,
  ): Promise<void> {
    const existing = await this.prisma.bill.findFirst({
      where: {
        recurringBillId: rec.id,
        referenceMonth,
        referenceYear,
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.bill.create({
      data: {
        familyId: rec.familyId,
        userId: rec.userId,
        categoryId: rec.categoryId,
        supplier: rec.supplier,
        amount: rec.amount,
        dueDate: dueDateOn(referenceYear, referenceMonth, rec.dayOfMonth),
        status: 'PENDING',
        referenceMonth,
        referenceYear,
        recurringBillId: rec.id,
      },
    });
  }
}
