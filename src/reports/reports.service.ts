import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { searchDateRange, ParsedSearch } from '../categories/search-query';
import { previousMonthRange, queryDateRange } from '../categories/finance-query';
import { INCOME_SLUG_KIND } from '../categories/income';
import { PrismaService } from '../common/prisma/prisma.service';
import { CategorySpend, withPercents } from './categorias-card';
import { ExtratoLine } from './extrato-card';
import { MonthForecast, buildForecast } from './previsao-card';
import { monthName } from '../documents/document-extraction';
import { UpcomingPayables, sumPayables } from './payable-card';
import { MonthSummary, roundMoney } from './resumo-card';

export type ExpenseFilter = {
  familyId: string;
  userId?: string;
  categoryIds?: string[];
  from: Date;
  to: Date;
};

export type TopExpense = {
  description: string;
  amount: number;
  emoji: string;
  categoryName: string;
};

const FIXED_EXPENSE_SLUGS = [
  'moradia',
  'energia',
  'agua',
  'internet',
  'telefonia',
  'cartao',
  'assinaturas',
  'emprestimos',
  'investimentos',
  ...Object.keys(INCOME_SLUG_KIND),
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async monthSummary(familyId: string, at = new Date()): Promise<MonthSummary> {
    const from = new Date(at.getFullYear(), at.getMonth(), 1);
    const to = new Date(at.getFullYear(), at.getMonth() + 1, 1);

    const [income, expenses, pendingBills] = await Promise.all([
      this.sumType(familyId, 'INCOME', from, to),
      this.sumType(familyId, 'EXPENSE', from, to),
      this.sumPendingBills(familyId),
    ]);

    const balance = roundMoney(income - expenses);
    const projected = roundMoney(balance - pendingBills);

    return {
      monthIndex: at.getMonth(),
      year: at.getFullYear(),
      income,
      expenses,
      balance,
      pendingBills,
      projected,
    };
  }

  async statement(
    familyId: string,
    from: Date,
    to: Date,
    limit = 50,
  ): Promise<{ rows: ExtratoLine[]; extra: number }> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyId,
        type: { in: ['EXPENSE', 'INCOME'] },
        transactionDate: { gte: from, lt: to },
        deletedAt: null,
      },
      include: { category: true, subcategory: true },
      orderBy: { transactionDate: 'desc' },
      take: limit + 1,
    });

    const extra = rows.length > limit ? rows.length - limit : 0;
    const visible = extra > 0 ? rows.slice(0, limit) : rows;

    return {
      rows: visible.map((row) => ({
        at: row.transactionDate,
        emoji: (row.subcategory ?? row.category).emoji,
        name: (row.subcategory ?? row.category).name,
        amount: roundMoney(Number(row.amount)),
        type: row.type,
      })),
      extra,
    };
  }

  async search(
    familyId: string,
    query: ParsedSearch,
    at = new Date(),
    limit = 50,
  ): Promise<{ rows: ExtratoLine[]; extra: number }> {
    const { from, to } = searchDateRange(query.when, at);
    const and: Prisma.TransactionWhereInput[] = [
      { familyId },
      { deletedAt: null },
      { type: 'EXPENSE' },
      { transactionDate: { gte: from, lt: to } },
    ];

    if (query.minAmount != null) {
      and.push({ amount: { gte: query.minAmount } });
    }

    if (query.cardHint) {
      and.push({
        OR: [
          { creditCard: { is: { name: { contains: query.cardHint, mode: 'insensitive' } } } },
          { merchant: { contains: query.cardHint, mode: 'insensitive' } },
          { rawText: { contains: query.cardHint, mode: 'insensitive' } },
          { description: { contains: query.cardHint, mode: 'insensitive' } },
        ],
      });
    }

    if (query.needle) {
      and.push({
        OR: [
          { merchant: { contains: query.needle, mode: 'insensitive' } },
          { description: { contains: query.needle, mode: 'insensitive' } },
          { rawText: { contains: query.needle, mode: 'insensitive' } },
          { category: { is: { name: { contains: query.needle, mode: 'insensitive' } } } },
          { subcategory: { is: { name: { contains: query.needle, mode: 'insensitive' } } } },
        ],
      });
    }

    const rows = await this.prisma.transaction.findMany({
      where: { AND: and },
      include: { category: true, subcategory: true },
      orderBy: { transactionDate: 'desc' },
      take: limit + 1,
    });

    const extra = rows.length > limit ? rows.length - limit : 0;
    const visible = extra > 0 ? rows.slice(0, limit) : rows;

    return {
      rows: visible.map((row) => ({
        at: row.transactionDate,
        emoji: (row.subcategory ?? row.category).emoji,
        name: row.merchant || (row.subcategory ?? row.category).name,
        amount: roundMoney(Number(row.amount)),
        type: row.type,
      })),
      extra,
    };
  }

  async expensesByCategory(
    familyId: string,
    at = new Date(),
    months = 1,
    userId?: string,
  ): Promise<CategorySpend[]> {
    const { from, to } = queryDateRange(months, at);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyId,
        userId,
        type: 'EXPENSE',
        transactionDate: { gte: from, lt: to },
        deletedAt: null,
      },
      include: {
        category: { include: { parent: true } },
        subcategory: true,
      },
    });

    const buckets = new Map<
      string,
      { emoji: string; name: string; amount: number }
    >();

    for (const tx of transactions) {
      const top = tx.subcategory ? tx.category : tx.category.parent ?? tx.category;
      const current = buckets.get(top.id) ?? {
        emoji: top.emoji,
        name: top.name,
        amount: 0,
      };
      current.amount += Number(tx.amount);
      buckets.set(top.id, current);
    }

    return withPercents([...buckets.values()]);
  }

  async sumExpenses(filter: ExpenseFilter): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        familyId: filter.familyId,
        userId: filter.userId,
        type: 'EXPENSE',
        transactionDate: { gte: filter.from, lt: filter.to },
        deletedAt: null,
        ...(filter.categoryIds
          ? {
              OR: [
                { categoryId: { in: filter.categoryIds } },
                { subcategoryId: { in: filter.categoryIds } },
              ],
            }
          : {}),
      },
    });

    return roundMoney(Number(result._sum.amount ?? 0));
  }

  async topExpenses(
    familyId: string,
    from: Date,
    to: Date,
    limit = 5,
    userId?: string,
  ): Promise<TopExpense[]> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyId,
        userId,
        type: 'EXPENSE',
        transactionDate: { gte: from, lt: to },
        deletedAt: null,
      },
      include: { category: true, subcategory: true },
      orderBy: { amount: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      description: row.description || row.merchant || (row.subcategory ?? row.category).name,
      amount: roundMoney(Number(row.amount)),
      emoji: (row.subcategory ?? row.category).emoji,
      categoryName: (row.subcategory ?? row.category).name,
    }));
  }

  async compareMonths(
    familyId: string,
    at = new Date(),
  ): Promise<{ current: number; previous: number }> {
    const currentRange = queryDateRange(1, at);
    const previousRange = previousMonthRange(at);
    const [current, previous] = await Promise.all([
      this.sumExpenses({ familyId, ...currentRange }),
      this.sumExpenses({ familyId, ...previousRange }),
    ]);

    return { current, previous };
  }

  async upcomingPayables(
    familyId: string,
    at = new Date(),
  ): Promise<UpcomingPayables> {
    const month = at.getMonth() + 1;
    const year = at.getFullYear();
    const cartao = await this.prisma.category.findUnique({
      where: { slug: 'cartao' },
    });

    const pendingBills = await this.prisma.bill.findMany({
      where: { familyId, status: 'PENDING' },
      select: {
        amount: true,
        recurringBillId: true,
        categoryId: true,
        supplier: true,
        dueDate: true,
        referenceMonth: true,
        referenceYear: true,
      },
    });

    const today = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    let bills = 0;
    let invoice = 0;
    const recurrenceLines: { label: string; amount: number }[] = [];
    const overdueLines: { label: string; amount: number }[] = [];
    for (const bill of pendingBills) {
      const amount = Number(bill.amount);
      if (cartao && bill.categoryId === cartao.id) {
        invoice += amount;
        continue;
      }
      if (bill.recurringBillId && bill.dueDate) {
        const due = new Date(
          bill.dueDate.getFullYear(),
          bill.dueDate.getMonth(),
          bill.dueDate.getDate(),
        );
        const monthLabel = monthName(bill.referenceMonth - 1);
        const line = {
          label: `${bill.supplier} · ${monthLabel}`,
          amount,
        };
        if (due < today) {
          overdueLines.push(line);
        } else {
          recurrenceLines.push(line);
        }
        continue;
      }
      bills += amount;
    }

    const dueInstallments = await this.prisma.installment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PENDING',
        transactionId: null,
        plan: { familyId },
      },
    });

    const recurrences = await this.prisma.recurringBill.findMany({
      where: { familyId, active: true },
      include: {
        bills: {
          where: { referenceMonth: month, referenceYear: year },
          select: { id: true },
        },
      },
    });

    for (const rec of recurrences) {
      if (rec.bills.length === 0) {
        const due = new Date(year, month - 1, rec.dayOfMonth);
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        if (dueDay >= today) {
          recurrenceLines.push({
            label: `${rec.supplier} · ${monthName(month - 1)}`,
            amount: Number(rec.amount),
          });
        }
      }
    }

    const invoices = await this.prisma.cardInvoice.aggregate({
      _sum: { amount: true },
      where: { familyId, status: 'PENDING' },
    });

    return sumPayables({
      bills,
      invoice: invoice + Number(invoices._sum.amount ?? 0),
      installments: Number(dueInstallments._sum.amount ?? 0),
      recurrences:
        recurrenceLines.reduce((sum, item) => sum + item.amount, 0) +
        overdueLines.reduce((sum, item) => sum + item.amount, 0),
      recurrenceLines,
      overdueLines,
    });
  }

  async monthForecast(
    familyId: string,
    at = new Date(),
  ): Promise<MonthForecast> {
    const month = at.getMonth() + 1;
    const year = at.getFullYear();
    const summary = await this.monthSummary(familyId, at);
    const payables = await this.upcomingPayables(familyId, at);

    const futureInstallments = await this.prisma.installment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PENDING',
        transactionId: null,
        plan: { familyId },
        OR: [
          { referenceYear: { gt: year } },
          { referenceYear: year, referenceMonth: { gt: month } },
        ],
      },
    });

    const thisMonthInstallments = roundMoney(
      Math.max(
        0,
        payables.installments - Number(futureInstallments._sum.amount ?? 0),
      ),
    );

    const expectedBills = roundMoney(
      payables.bills + payables.recurrences + thisMonthInstallments,
    );
    const variableEstimate = await this.estimateVariable(familyId, at);

    return buildForecast(summary.balance, expectedBills, variableEstimate);
  }

  private async estimateVariable(
    familyId: string,
    at: Date,
  ): Promise<number> {
    const fromBudget = await this.remainingBudgets(familyId, at);
    if (fromBudget !== null) {
      return fromBudget;
    }

    const variableIds = await this.variableCategoryIds();
    if (variableIds.length === 0) {
      return 0;
    }

    const thisMonth = queryDateRange(1, at);
    const lastMonth = previousMonthRange(at);
    const [current, previous] = await Promise.all([
      this.sumExpenses({ familyId, categoryIds: variableIds, ...thisMonth }),
      this.sumExpenses({ familyId, categoryIds: variableIds, ...lastMonth }),
    ]);

    return roundMoney(Math.max(0, previous - current));
  }

  private async remainingBudgets(
    familyId: string,
    at: Date,
  ): Promise<number | null> {
    const budgets = await this.prisma.budget.findMany({
      where: { familyId },
      include: { category: { include: { children: true } } },
    });
    if (budgets.length === 0) {
      return null;
    }

    const { from, to } = queryDateRange(1, at);
    let remaining = 0;
    for (const budget of budgets) {
      const categoryIds = [
        budget.category.id,
        ...budget.category.children.map((child) => child.id),
      ];
      const spent = await this.sumExpenses({
        familyId,
        categoryIds,
        from,
        to,
      });
      remaining += Math.max(0, Number(budget.amount) - spent);
    }

    return roundMoney(remaining);
  }

  private async variableCategoryIds(): Promise<string[]> {
    const rows = await this.prisma.category.findMany({
      where: { slug: { notIn: [...FIXED_EXPENSE_SLUGS] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async sumType(
    familyId: string,
    type: TransactionType,
    from: Date,
    to: Date,
  ): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        familyId,
        type,
        transactionDate: { gte: from, lt: to },
        deletedAt: null,
      },
    });

    return roundMoney(Number(result._sum.amount ?? 0));
  }

  private async sumPendingBills(familyId: string): Promise<number> {
    const result = await this.prisma.bill.aggregate({
      _sum: { amount: true },
      where: { familyId, status: 'PENDING' },
    });

    return roundMoney(Number(result._sum.amount ?? 0));
  }
}
