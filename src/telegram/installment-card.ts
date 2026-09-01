import { formatMoney } from './movement-card';

export type InstallmentCardInput = {
  description: string;
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  cardName?: string | null;
};

export function buildInstallmentCard(plan: InstallmentCardInput): string {
  const future = Math.max(plan.installmentCount - 1, 0);
  const lines = [
    '💳 Parcelamento registrado',
    '',
    'Compra:',
    formatMoney(plan.totalAmount),
    '',
    'Parcelamento:',
    `${plan.installmentCount}x ${formatMoney(plan.installmentAmount)}`,
  ];

  if (plan.cardName) {
    lines.push('', 'Cartão:', plan.cardName);
  }

  lines.push(
    '',
    `1/${plan.installmentCount} neste mês`,
    `${future} parcela${future === 1 ? '' : 's'} futura${future === 1 ? '' : 's'}`,
  );

  return lines.join('\n');
}
