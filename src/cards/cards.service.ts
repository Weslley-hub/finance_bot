import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeText } from '../categories/text-normalize';
import { PrismaService } from '../common/prisma/prisma.service';
import { invoiceCycleFor } from './card-cycle';
import { CartaoView, CardLimitView } from './cartao-card';

export type CardPlacement = {
  cardId: string;
  invoiceId: string;
  cardName: string;
  closingDate: Date;
  dueDate: Date;
};

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  upsert(familyId: string, name: string) {
    return this.prisma.card.upsert({
      where: {
        familyId_name: { familyId, name },
      },
      create: { familyId, name },
      update: {},
    });
  }

  async upsertDetails(data: {
    familyId: string;
    name: string;
    creditLimit: number;
    closingDay: number;
    dueDay: number;
  }) {
    const existing = await this.prisma.card.findFirst({
      where: {
        familyId: data.familyId,
        name: { equals: data.name, mode: 'insensitive' },
      },
    });

    const payload = {
      creditLimit: new Prisma.Decimal(data.creditLimit),
      closingDay: data.closingDay,
      dueDay: data.dueDay,
    };

    if (existing) {
      return this.prisma.card.update({
        where: { id: existing.id },
        data: { ...payload, name: existing.name },
      });
    }

    return this.prisma.card.create({
      data: {
        familyId: data.familyId,
        name: data.name,
        ...payload,
      },
    });
  }

  async list(familyId: string): Promise<CartaoView[]> {
    const rows = await this.prisma.card.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      name: row.name,
      creditLimit: row.creditLimit == null ? null : Number(row.creditLimit),
      closingDay: row.closingDay,
      dueDay: row.dueDay,
    }));
  }

  async removeByName(familyId: string, name: string) {
    const existing = await this.prisma.card.findFirst({
      where: {
        familyId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (!existing) {
      return null;
    }

    await this.prisma.card.delete({ where: { id: existing.id } });
    return existing;
  }

  async setUsedAmount(familyId: string, name: string, amount: number) {
    const existing = await this.prisma.card.findFirst({
      where: {
        familyId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (!existing) {
      return null;
    }

    return this.prisma.card.update({
      where: { id: existing.id },
      data: { usedAmount: new Prisma.Decimal(amount) },
    });
  }

  async listWithUsage(
    familyId: string,
    at = new Date(),
  ): Promise<CardLimitView[]> {
    const cards = await this.prisma.card.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
    });

    const views: CardLimitView[] = [];
    for (const card of cards) {
      let invoiceUsed = 0;
      if (card.closingDay != null && card.dueDay != null) {
        const cycle = invoiceCycleFor(card.closingDay, card.dueDay, at);
        const invoice = await this.prisma.cardInvoice.findUnique({
          where: {
            cardId_referenceMonth_referenceYear: {
              cardId: card.id,
              referenceMonth: cycle.referenceMonth,
              referenceYear: cycle.referenceYear,
            },
          },
        });
        invoiceUsed = invoice ? Number(invoice.amount) : 0;
      }

      const creditLimit =
        card.creditLimit == null ? null : Number(card.creditLimit);
      const opening = Number(card.usedAmount);
      const used = opening + invoiceUsed;
      views.push({
        name: card.name,
        creditLimit,
        used,
        available:
          creditLimit == null ? null : Math.max(0, creditLimit - used),
      });
    }

    return views;
  }

  async placementFor(
    familyId: string,
    text: string,
    at = new Date(),
  ): Promise<CardPlacement | null> {
    const cards = await this.prisma.card.findMany({
      where: {
        familyId,
        closingDay: { not: null },
        dueDay: { not: null },
      },
    });

    const haystack = normalizeText(text);
    let best: (typeof cards)[number] | undefined;
    for (const card of cards) {
      const key = normalizeText(card.name);
      if (key.length < 2 || !haystack.includes(key)) {
        continue;
      }
      if (!best || key.length > normalizeText(best.name).length) {
        best = card;
      }
    }

    if (!best || best.closingDay == null || best.dueDay == null) {
      return null;
    }

    const cycle = invoiceCycleFor(best.closingDay, best.dueDay, at);
    const invoice = await this.prisma.cardInvoice.upsert({
      where: {
        cardId_referenceMonth_referenceYear: {
          cardId: best.id,
          referenceMonth: cycle.referenceMonth,
          referenceYear: cycle.referenceYear,
        },
      },
      create: {
        familyId,
        cardId: best.id,
        referenceMonth: cycle.referenceMonth,
        referenceYear: cycle.referenceYear,
        closingDate: cycle.closingDate,
        dueDate: cycle.dueDate,
        status: 'PENDING',
        amount: 0,
      },
      update: {},
    });

    return {
      cardId: best.id,
      invoiceId: invoice.id,
      cardName: best.name,
      closingDate: invoice.closingDate,
      dueDate: invoice.dueDate,
    };
  }

  async addToInvoice(invoiceId: string, amount: number): Promise<void> {
    await this.prisma.cardInvoice.update({
      where: { id: invoiceId },
      data: { amount: { increment: amount } },
    });
  }

  async removeFromInvoice(invoiceId: string, amount: number): Promise<void> {
    const invoice = await this.prisma.cardInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      return;
    }

    const next = Math.max(0, Number(invoice.amount) - amount);
    await this.prisma.cardInvoice.update({
      where: { id: invoiceId },
      data: { amount: new Prisma.Decimal(next) },
    });
  }
}
