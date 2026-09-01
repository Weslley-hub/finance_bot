import { formatMoney } from './movement-card';
import {
  InvoiceCounts,
  InvoiceItemStatus,
} from '../documents/card-invoice';

export type InvoicePreviewItem = {
  merchant: string;
  amount: number;
  categoryName: string;
  status: InvoiceItemStatus;
};

export function buildInvoicePreviewCard(counts: InvoiceCounts): string {
  return [
    `Encontrei ${counts.total} ${counts.total === 1 ? 'transação' : 'transações'}.`,
    '',
    `${counts.recognized} ${counts.recognized === 1 ? 'reconhecida' : 'reconhecidas'}`,
    `${counts.review} ${counts.review === 1 ? 'precisa' : 'precisam'} de revisão`,
    `${counts.duplicates} ${counts.duplicates === 1 ? 'parece' : 'parecem'} duplicada${counts.duplicates === 1 ? '' : 's'}`,
  ].join('\n');
}

export function invoiceKeyboard(id: string) {
  return {
    inline_keyboard: [
      [{ text: 'Revisar', callback_data: `inv:rev:${id}` }],
      [{ text: 'Importar', callback_data: `inv:ok:${id}` }],
    ],
  };
}

export function buildInvoiceReviewCard(items: InvoicePreviewItem[]): string {
  const review = items.filter((item) => item.status === 'review');
  const duplicates = items.filter((item) => item.status === 'duplicate');

  if (review.length === 0 && duplicates.length === 0) {
    return 'Nada para revisar. Pode importar.';
  }

  const lines: string[] = [];
  if (review.length > 0) {
    lines.push('Precisam de revisão:');
    for (const item of review.slice(0, 20)) {
      lines.push(
        `• ${item.merchant} — ${formatMoney(item.amount)} → ${item.categoryName}`,
      );
    }
    if (review.length > 20) {
      lines.push(`… e mais ${review.length - 20}`);
    }
  }

  if (duplicates.length > 0) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('Parecem duplicadas:');
    for (const item of duplicates.slice(0, 10)) {
      lines.push(`• ${item.merchant} — ${formatMoney(item.amount)}`);
    }
  }

  return lines.join('\n');
}

export function buildInvoiceImportCard(
  cardName: string,
  counts: InvoiceCounts,
  imported: number,
): string {
  const lines = [
    `Importei ${imported} ${imported === 1 ? 'lançamento' : 'lançamentos'} da fatura ${cardName}.`,
  ];

  if (counts.review > 0) {
    lines.push(
      `${counts.review} ${counts.review === 1 ? 'ficou' : 'ficaram'} de fora (precisam de revisão).`,
    );
  }

  if (counts.duplicates > 0) {
    lines.push(
      `${counts.duplicates} duplicada${counts.duplicates === 1 ? '' : 's'} ignorada${counts.duplicates === 1 ? '' : 's'}.`,
    );
  }

  return lines.join('\n');
}
