import { TransactionType } from '@prisma/client';
import { formatShortDate } from '../documents/document-extraction';
import { roundMoney } from './resumo-card';

export type ExtratoLine = {
  at: Date;
  emoji: string;
  name: string;
  amount: number;
  type: TransactionType;
};

const NAME_WIDTH = 14;
const AMOUNT_WIDTH = 6;

export function buildExtratoCard(rows: ExtratoLine[], extra = 0): string {
  if (rows.length === 0) {
    return 'Nenhum lançamento neste período.';
  }

  const lines = rows.map(formatLine);
  if (extra > 0) {
    lines.push('… e mais lançamentos');
  }

  return lines.join('\n');
}

export function formatSignedAmount(type: TransactionType, amount: number): string {
  const abs = roundMoney(Math.abs(amount));
  const body =
    abs % 1 === 0
      ? String(Math.round(abs))
      : abs.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const sign = type === 'INCOME' ? '+' : '-';
  return `${sign}${body}`;
}

function formatLine(row: ExtratoLine): string {
  const date = formatShortDate(row.at);
  const name = padName(row.name);
  const amount = formatSignedAmount(row.type, row.amount).padStart(AMOUNT_WIDTH);
  return `${date} ${row.emoji} ${name}${amount}`;
}

function padName(name: string): string {
  if (name.length >= NAME_WIDTH) {
    return `${name} `;
  }

  return name.padEnd(NAME_WIDTH);
}
