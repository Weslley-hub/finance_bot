import { roundMoney } from './resumo-card';

export type MonthForecast = {
  balance: number;
  expectedBills: number;
  variableEstimate: number;
  projected: number;
};

export function buildForecast(
  balance: number,
  expectedBills: number,
  variableEstimate: number,
): MonthForecast {
  return {
    balance: roundMoney(balance),
    expectedBills: roundMoney(expectedBills),
    variableEstimate: roundMoney(variableEstimate),
    projected: roundMoney(balance - expectedBills - variableEstimate),
  };
}

export function buildPrevisaoCard(forecast: MonthForecast): string {
  return [
    'Saldo atual:',
    formatMoney(forecast.balance),
    '',
    'Contas previstas:',
    formatMoney(forecast.expectedBills),
    '',
    'Gastos variáveis estimados:',
    formatMoney(forecast.variableEstimate),
    '',
    'Saldo projetado:',
    formatMoney(forecast.projected),
  ].join('\n');
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
