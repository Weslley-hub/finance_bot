import { BillStatus } from '@prisma/client';
import { formatShortDate, monthName } from '../documents/document-extraction';
import { formatMoney } from './movement-card';

export type ContasBill = {
  status: BillStatus;
  supplier: string;
  amount: number;
  dueDate?: Date | null;
  category: {
    slug: string;
    name: string;
  };
};

export function billDisplayName(bill: ContasBill): string {
  const generic = [
    'outros',
    'outras-receitas',
    'assinaturas',
    'saude',
    'lazer',
    'trabalho',
  ];
  if (generic.includes(bill.category.slug)) {
    return bill.supplier;
  }

  return bill.category.name;
}

export function buildContasCard(monthIndex: number, bills: ContasBill[]): string {
  const month = monthName(monthIndex).toUpperCase();
  const lines = [`📅 CONTAS — ${month}`, ''];

  const active = bills.filter((bill) => bill.status !== 'CANCELLED');
  const paid = active.filter((bill) => bill.status === 'PAID');
  const pending = [...active.filter((bill) => bill.status === 'PENDING')].sort(
    (a, b) => {
      const aTime = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    },
  );

  if (active.length === 0) {
    lines.push('Nenhuma conta neste mês.');
    lines.push('');
    lines.push('Envie a foto ou o PDF da conta para adicionar.');
    return lines.join('\n');
  }

  for (const bill of [...paid, ...pending]) {
    const icon = bill.status === 'PAID' ? '✅' : '⏳';
    lines.push(`${icon} ${billDisplayName(bill)}`);
    lines.push(formatMoney(bill.amount));
    if (bill.status === 'PENDING' && bill.dueDate) {
      lines.push(formatShortDate(bill.dueDate));
    }
    lines.push('');
  }

  const paidTotal = roundMoney(paid.reduce((sum, bill) => sum + bill.amount, 0));
  const pendingTotal = roundMoney(
    pending.reduce((sum, bill) => sum + bill.amount, 0),
  );

  lines.push('─────────────');
  lines.push('');
  lines.push('Pago:');
  lines.push(formatMoney(paidTotal));
  lines.push('');
  lines.push('Pendente:');
  lines.push(formatMoney(pendingTotal));

  return lines.join('\n');
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
