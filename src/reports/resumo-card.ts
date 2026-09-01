export type MonthSummary = {
  monthIndex: number;
  year: number;
  income: number;
  expenses: number;
  balance: number;
  pendingBills: number;
  projected: number;
};

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function buildResumoCard(summary: MonthSummary): string {
  const months = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO',
  ];
  const header = `📊 ${months[summary.monthIndex]}/${summary.year}`;

  return [
    header,
    '',
    'Receitas',
    formatResumoMoney(summary.income),
    '',
    'Despesas',
    formatResumoMoney(summary.expenses),
    '',
    'Saldo',
    formatResumoMoney(summary.balance),
    '',
    'Contas pendentes',
    formatResumoMoney(summary.pendingBills),
    '',
    'Saldo projetado',
    formatResumoMoney(summary.projected),
  ].join('\n');
}

function formatResumoMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
