import { buildForecast, buildPrevisaoCard } from './previsao-card';

describe('buildForecast', () => {
  it('calcula o saldo projetado do épico', () => {
    expect(buildForecast(4720, 2180, 900)).toEqual({
      balance: 4720,
      expectedBills: 2180,
      variableEstimate: 900,
      projected: 1640,
    });
  });
});

describe('buildPrevisaoCard', () => {
  it('monta o cartão da previsão', () => {
    const card = buildPrevisaoCard({
      balance: 4720,
      expectedBills: 2180,
      variableEstimate: 900,
      projected: 1640,
    });

    expect(card).toContain('Saldo atual:');
    expect(card).toContain('Contas previstas:');
    expect(card).toContain('Gastos variáveis estimados:');
    expect(card).toContain('Saldo projetado:');
  });
});
