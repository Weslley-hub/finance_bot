import { roundMoney } from './resumo-card';

export type CategorySpend = {
  emoji: string;
  name: string;
  amount: number;
  percent: number;
};

export function buildCategoriasCard(rows: CategorySpend[]): string {
  if (rows.length === 0) {
    return 'Nenhuma despesa neste mês.';
  }

  return rows
    .map((row) =>
      [`${row.emoji} ${row.name}`, formatMoney(row.amount), `${row.percent}%`].join(
        '\n',
      ),
    )
    .join('\n\n');
}

export function withPercents(
  rows: Array<{ emoji: string; name: string; amount: number }>,
): CategorySpend[] {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (total <= 0) {
    return [];
  }

  return rows
    .map((row) => ({
      ...row,
      amount: roundMoney(row.amount),
      percent: Math.round((row.amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
