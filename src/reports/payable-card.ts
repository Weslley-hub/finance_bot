import { roundMoney } from './resumo-card';

export type PayableLine = {
  label: string;
  amount: number;
};

export type UpcomingPayables = {
  bills: number;
  invoice: number;
  installments: number;
  recurrences: number;
  total: number;
  recurrenceLines: PayableLine[];
  overdueLines: PayableLine[];
};

export function buildPayableCard(payables: UpcomingPayables): string {
  const lines = [
    '💸 Ainda para pagar',
    '',
    'Contas pendentes',
    formatMoney(payables.bills),
    '',
    'Fatura',
    formatMoney(payables.invoice),
    '',
    'Parcelas',
    formatMoney(payables.installments),
    '',
    'Recorrências',
  ];

  if (payables.recurrenceLines.length > 0) {
    for (const item of payables.recurrenceLines) {
      lines.push(`${item.label} · ${formatMoney(item.amount)}`);
    }
  } else if (payables.overdueLines.length > 0) {
    lines.push(formatMoney(0));
  } else {
    lines.push(formatMoney(payables.recurrences));
  }

  if (payables.overdueLines.length > 0) {
    lines.push('', 'Atrasadas');
    for (const item of payables.overdueLines) {
      lines.push(`${item.label} · ${formatMoney(item.amount)}`);
    }
  }

  lines.push(
    '',
    '─────────────',
    '',
    'Total',
    formatMoney(payables.total),
  );

  return lines.join('\n');
}

export function sumPayables(
  parts: Omit<UpcomingPayables, 'total'>,
): UpcomingPayables {
  const bills = roundMoney(parts.bills);
  const invoice = roundMoney(parts.invoice);
  const installments = roundMoney(parts.installments);
  const recurrences = roundMoney(parts.recurrences);
  return {
    bills,
    invoice,
    installments,
    recurrences,
    recurrenceLines: parts.recurrenceLines ?? [],
    overdueLines: parts.overdueLines ?? [],
    total: roundMoney(bills + invoice + installments + recurrences),
  };
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
