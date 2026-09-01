import { Injectable } from '@nestjs/common';
import {
  CategorizationSource,
  Prisma,
  Transaction,
  TransactionHistoryAction,
  TransactionSource,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  DuplicateHit,
  DuplicateProbe,
  pickDuplicate,
} from './duplicate';
import { splitCategoryIds } from './transaction-category';
import {
  asSnapshot,
  formatHistoryLine,
  transactionSnapshot,
} from './transaction-history';

export const TRANSACTION_ALIVE = { deletedAt: null } as const;

const withCard = {
  category: { include: { parent: true } },
  subcategory: { include: { parent: true } },
  user: true,
  cardInvoice: { include: { card: true } },
  creditCard: true,
} as const;

export type TransactionWithCard = Prisma.TransactionGetPayload<{
  include: typeof withCard;
}>;

export type CreateTransactionInput = {
  familyId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  merchant?: string;
  rawText?: string;
  categoryId: string;
  source: TransactionSource;
  categorizationSource?: CategorizationSource;
  confidence?: number;
  transactionDate?: Date;
  accountId?: string;
  creditCardId?: string;
  sourceDocumentId?: string;
  cardInvoiceId?: string;
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTransactionInput): Promise<TransactionWithCard> {
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    const split = category
      ? splitCategoryIds(category)
      : { categoryId: data.categoryId, subcategoryId: null };
    const categorizationSource = data.categorizationSource ?? 'RULE';

    const created = await this.prisma.transaction.create({
      data: {
        familyId: data.familyId,
        userId: data.userId,
        type: data.type,
        amount: new Prisma.Decimal(data.amount),
        description: data.description,
        merchant: data.merchant,
        rawText: data.rawText,
        categoryId: split.categoryId,
        subcategoryId: split.subcategoryId,
        accountId: data.accountId,
        creditCardId: data.creditCardId,
        transactionDate: data.transactionDate ?? new Date(),
        source: data.source,
        sourceDocumentId: data.sourceDocumentId,
        categorizationSource,
        confidence: data.confidence ?? defaultConfidence(categorizationSource),
        cardInvoiceId: data.cardInvoiceId,
      },
    });

    await this.recordHistory({
      transactionId: created.id,
      familyId: created.familyId,
      changedById: data.userId,
      action: 'CREATED',
      previousValue: null,
      newValue: created,
    });

    return this.findByIdOrThrow(created.id);
  }

  findById(id: string): Promise<TransactionWithCard | null> {
    return this.prisma.transaction.findFirst({
      where: { id, ...TRANSACTION_ALIVE },
      include: withCard,
    });
  }

  findLastByUser(
    familyId: string,
    userId: string,
  ): Promise<TransactionWithCard | null> {
    return this.prisma.transaction.findFirst({
      where: { familyId, userId, ...TRANSACTION_ALIVE },
      orderBy: { createdAt: 'desc' },
      include: withCard,
    });
  }

  async update(
    id: string,
    data: {
      amount?: number;
      description?: string;
      merchant?: string;
      categoryId?: string;
      type?: TransactionType;
      transactionDate?: Date;
      categorizationSource?: CategorizationSource;
      confidence?: number;
    },
    actorUserId: string,
  ): Promise<TransactionWithCard> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, ...TRANSACTION_ALIVE },
    });
    if (!existing) {
      throw new Error('Transação não encontrada');
    }

    let categoryId = data.categoryId;
    let subcategoryId: string | null | undefined;
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (category) {
        const split = splitCategoryIds(category);
        categoryId = split.categoryId;
        subcategoryId = split.subcategoryId;
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        amount:
          data.amount === undefined
            ? undefined
            : new Prisma.Decimal(data.amount),
        description: data.description,
        merchant: data.merchant,
        categoryId,
        subcategoryId,
        type: data.type,
        transactionDate: data.transactionDate,
        categorizationSource: data.categorizationSource,
        confidence: data.confidence,
      },
    });

    await this.recordHistory({
      transactionId: id,
      familyId: existing.familyId,
      changedById: actorUserId,
      action: 'UPDATED',
      previousValue: existing,
      newValue: updated,
    });

    return this.findByIdOrThrow(id);
  }

  async delete(id: string, actorUserId: string): Promise<Transaction> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, ...TRANSACTION_ALIVE },
    });
    if (!existing) {
      throw new Error('Transação não encontrada');
    }

    const archived = await this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.recordHistory({
      transactionId: id,
      familyId: existing.familyId,
      changedById: actorUserId,
      action: 'DELETED',
      previousValue: existing,
      newValue: null,
    });

    if (existing.cardInvoiceId) {
      const invoice = await this.prisma.cardInvoice.findUnique({
        where: { id: existing.cardInvoiceId },
      });
      if (invoice) {
        const next = Math.max(0, Number(invoice.amount) - Number(existing.amount));
        await this.prisma.cardInvoice.update({
          where: { id: invoice.id },
          data: { amount: new Prisma.Decimal(next) },
        });
      }
    }

    return archived;
  }

  async listHistory(familyId: string, limit = 10) {
    const rows = await this.prisma.transactionHistory.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { changedBy: true },
    });

    return rows.map((row) =>
      formatHistoryLine({
        action: row.action,
        changedByName: row.changedBy.name,
        previousValue: asSnapshot(row.previousValue),
        newValue: asSnapshot(row.newValue),
        createdAt: row.createdAt,
      }),
    );
  }

  async findPossibleDuplicate(probe: DuplicateProbe & { familyId: string }): Promise<DuplicateHit | null> {
    const from = new Date(probe.at);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(probe.at);
    to.setDate(to.getDate() + 2);
    to.setHours(0, 0, 0, 0);

    const rows = await this.prisma.transaction.findMany({
      where: {
        familyId: probe.familyId,
        userId: probe.userId,
        type: probe.type,
        amount: new Prisma.Decimal(probe.amount.toFixed(2)),
        transactionDate: { gte: from, lt: to },
        ...TRANSACTION_ALIVE,
      },
      include: {
        category: { include: { parent: true } },
        subcategory: true,
      },
      orderBy: { transactionDate: 'desc' },
      take: 20,
    });

    return pickDuplicate(
      probe,
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        type: row.type,
        amount: Number(row.amount),
        createdAt: row.transactionDate,
        description: row.description,
        merchant: row.merchant,
        rawText: row.rawText,
        categoryId: row.subcategoryId ?? row.categoryId,
        categoryName: row.subcategory?.name ?? row.category.parent?.name ?? row.category.name,
      })),
    );
  }

  async sumExpenses(params: {
    familyId: string;
    userId?: string;
    from: Date;
  }): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        familyId: params.familyId,
        userId: params.userId,
        type: 'EXPENSE',
        transactionDate: { gte: params.from },
        ...TRANSACTION_ALIVE,
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  private async findByIdOrThrow(id: string): Promise<TransactionWithCard> {
    const row = await this.findById(id);
    if (!row) {
      throw new Error('Transação não encontrada');
    }

    return row;
  }

  private recordHistory(input: {
    transactionId: string;
    familyId: string;
    changedById: string;
    action: TransactionHistoryAction;
    previousValue: Parameters<typeof transactionSnapshot>[0] | null;
    newValue: Parameters<typeof transactionSnapshot>[0] | null;
  }) {
    return this.prisma.transactionHistory.create({
      data: {
        transactionId: input.transactionId,
        familyId: input.familyId,
        changedById: input.changedById,
        action: input.action,
        previousValue: input.previousValue
          ? transactionSnapshot(input.previousValue)
          : Prisma.DbNull,
        newValue: input.newValue
          ? transactionSnapshot(input.newValue)
          : Prisma.DbNull,
      },
    });
  }
}

function defaultConfidence(source: CategorizationSource): number {
  if (source === 'MANUAL') {
    return 1;
  }
  if (source === 'AI') {
    return 0.7;
  }
  return 0.9;
}
