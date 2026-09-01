import { CategorySpend, buildCategoriasCard } from './categorias-card';
import { roundMoney } from './resumo-card';

export function periodLabel(months: number): string {
  if (months <= 1) {
    return 'neste mês';
  }

  return `nos últimos ${months} meses`;
}

export function buildSpendAnswer(input: {
  who: string;
  amount: number;
  category?: { emoji: string; name: string };
  months: number;
}): string {
  const verb = input.who === 'Vocês' ? 'gastaram' : 'gastou';
  const money = formatMoney(input.amount);
  const when = periodLabel(input.months);

  if (input.category) {
    return [
      `${input.category.emoji} ${input.category.name}`,
      `${input.who} ${verb} ${money} ${when}.`,
    ].join('\n');
  }

  return `${input.who} ${verb} ${money} ${when}.`;
}

export function buildCompareAnswer(current: number, previous: number): string {
  const delta = roundMoney(current - previous);
  const lines = [
    `Este mês: ${formatMoney(current)}`,
    `Mês passado: ${formatMoney(previous)}`,
    '',
  ];

  if (delta === 0) {
    lines.push('Vocês gastaram o mesmo que no mês passado.');
  } else if (delta > 0) {
    lines.push(
      `Vocês gastaram ${formatMoney(delta)} a mais que no mês passado.`,
    );
  } else {
    lines.push(
      `Vocês gastaram ${formatMoney(Math.abs(delta))} a menos que no mês passado.`,
    );
  }

  return lines.join('\n');
}

export function buildTopCategoriesAnswer(
  rows: CategorySpend[],
  months: number,
): string {
  if (rows.length === 0) {
    return emptySpend(months);
  }

  return `Onde vocês mais gastam ${periodLabel(months)}:\n\n${buildCategoriasCard(rows)}`;
}

export function buildTopExpensesAnswer(
  rows: Array<{
    description: string;
    amount: number;
    emoji: string;
  }>,
  months: number,
): string {
  if (rows.length === 0) {
    return emptySpend(months);
  }

  const body = rows
    .map(
      (row, index) =>
        `${index + 1}. ${row.emoji} ${row.description} — ${formatMoney(row.amount)}`,
    )
    .join('\n');

  return `Maiores despesas ${periodLabel(months)}:\n\n${body}`;
}

export function emptySpend(months: number): string {
  return months <= 1
    ? 'Nenhuma despesa neste mês.'
    : `Nenhuma despesa ${periodLabel(months)}.`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
