import { Injectable } from '@nestjs/common';
import { BillStatus, Prisma } from '@prisma/client';
import { matchCategoryKeyword } from '../categories/match-category-keywords';
import { normalizeText } from '../categories/text-normalize';
import { PrismaService } from '../common/prisma/prisma.service';

const withCategory = {
  category: { include: { parent: true } },
} as const;

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    familyId: string;
    userId: string;
    categoryId: string;
    supplier: string;
    amount: number;
    dueDate?: Date | null;
    barcode?: string | null;
    status?: BillStatus;
    referenceMonth: number;
    referenceYear: number;
    documentId?: string | null;
    paidTransactionId?: string | null;
    recurringBillId?: string | null;
  }) {
    return this.prisma.bill.create({
      data: {
        ...data,
        amount: new Prisma.Decimal(data.amount),
      },
      include: withCategory,
    });
  }

  findPendingByHint(familyId: string, hint: string) {
    return this.prisma.bill.findMany({
      where: { familyId, status: 'PENDING' },
      include: withCategory,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }).then((bills) => {
      const needle = normalizeText(hint);
      const slug = matchCategoryKeyword(hint);

      return bills.find((bill) => {
        const haystack = normalizeText(
          `${bill.supplier} ${bill.category.name} ${bill.category.slug}`,
        );
        return (
          (slug && bill.category.slug === slug) ||
          haystack.includes(needle) ||
          needle.includes(normalizeText(bill.supplier))
        );
      });
    });
  }

  markPaid(id: string, paidTransactionId: string) {
    return this.prisma.bill.update({
      where: { id },
      data: { status: 'PAID', paidTransactionId },
      include: withCategory,
    });
  }

  listForMonth(familyId: string, referenceMonth: number, referenceYear: number) {
    return this.prisma.bill.findMany({
      where: {
        familyId,
        referenceMonth,
        referenceYear,
        status: { in: ['PENDING', 'PAID'] },
      },
      include: withCategory,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
