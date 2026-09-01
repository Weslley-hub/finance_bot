import { roundMoney } from '../reports/resumo-card';

export const BUDGET_NEAR_RATIO = 0.8;

export type BudgetRow = {
  name: string;
  amount: number;
};

export type BudgetWarning = {
  name: string;
  spent: number;
  amount: number;
  remaining: number;
};

export function isBudgetNear(spent: number, amount: number): boolean {
  if (amount <= 0) {
    return false;
  }

  return spent >= roundMoney(amount * BUDGET_NEAR_RATIO);
}

export function buildOrcamentoCard(rows: BudgetRow[]): string {
  if (rows.length === 0) {
    return [
      'Nenhum orçamento definido.',
      '',
      'Exemplo: orçamento mercado 1200',
    ].join('\n');
  }

  return rows
    .map((row) => `${row.name}\n${formatBudgetMoney(row.amount)}/mês`)
    .join('\n\n');
}

export function buildBudgetWarningCard(warning: BudgetWarning): string {
  const remainingLabel = warning.remaining >= 0 ? 'Restam:' : 'Passou:';
  const remainingValue = formatBudgetMoney(Math.abs(warning.remaining));

  return [
    `⚠️ ${warning.name}`,
    '',
    'Vocês já gastaram:',
    formatBudgetMoney(warning.spent),
    '',
    'Orçamento:',
    formatBudgetMoney(warning.amount),
    '',
    remainingLabel,
    remainingValue,
  ].join('\n');
}

function formatBudgetMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
