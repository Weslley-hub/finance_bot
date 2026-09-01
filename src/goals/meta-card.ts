import { roundMoney } from '../reports/resumo-card';

export type GoalProgress = {
  saved: number;
  target: number;
  percent: number;
};

export function goalPercent(saved: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.round((saved / target) * 100);
}

export function toGoalProgress(saved: number, target: number): GoalProgress {
  const safeSaved = Math.max(0, roundMoney(saved));
  const safeTarget = roundMoney(target);
  return {
    saved: safeSaved,
    target: safeTarget,
    percent: goalPercent(safeSaved, safeTarget),
  };
}

export function buildMetaCard(progress: GoalProgress): string {
  return [
    '🎯 Meta mensal',
    '',
    `${formatMoney(progress.saved)} / ${formatMoney(progress.target)}`,
    '',
    `${progress.percent}%`,
  ].join('\n');
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
