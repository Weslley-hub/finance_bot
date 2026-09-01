import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { queryDateRange } from '../categories/finance-query';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { roundMoney } from '../reports/resumo-card';
import {
  BudgetRow,
  BudgetWarning,
  isBudgetNear,
} from './orcamento-card';

const withCategory = {
  category: { include: { children: true } },
} as const;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async upsert(familyId: string, categoryId: string, amount: number) {
    return this.prisma.budget.upsert({
      where: {
        familyId_categoryId: { familyId, categoryId },
      },
      create: {
        familyId,
        categoryId,
        amount: new Prisma.Decimal(amount),
      },
      update: {
        amount: new Prisma.Decimal(amount),
      },
      include: withCategory,
    });
  }

  async list(familyId: string): Promise<BudgetRow[]> {
    const rows = await this.prisma.budget.findMany({
      where: { familyId },
      include: { category: true },
      orderBy: { amount: 'desc' },
    });

    return rows.map((row) => ({
      name: row.category.name,
      amount: roundMoney(Number(row.amount)),
    }));
  }

  async warningFor(
    familyId: string,
    categoryId: string,
    at = new Date(),
  ): Promise<BudgetWarning | null> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return null;
    }

    const candidateIds = [category.id, category.parentId].filter(
      (id): id is string => Boolean(id),
    );

    const budgets = await this.prisma.budget.findMany({
      where: { familyId, categoryId: { in: candidateIds } },
      include: withCategory,
    });

    const preferred = [
      ...budgets.filter((budget) => budget.categoryId === category.id),
      ...budgets.filter((budget) => budget.categoryId !== category.id),
    ];

    const { from, to } = queryDateRange(1, at);

    for (const budget of preferred) {
      const categoryIds = [
        budget.category.id,
        ...budget.category.children.map((child) => child.id),
      ];
      const spent = await this.reports.sumExpenses({
        familyId,
        categoryIds,
        from,
        to,
      });
      const amount = roundMoney(Number(budget.amount));
      if (!isBudgetNear(spent, amount)) {
        continue;
      }

      return {
        name: budget.category.name,
        spent,
        amount,
        remaining: roundMoney(amount - spent),
      };
    }

    return null;
  }
}
