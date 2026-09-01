import { buildCartaoCard, buildCartoesList, buildLimitesCard } from './cartao-card';

describe('buildCartaoCard', () => {
  it('mostra limite, fechamento e vencimento', () => {
    const card = buildCartaoCard({
      name: 'Nubank',
      creditLimit: 5000,
      closingDay: 22,
      dueDay: 29,
    });

    expect(card).toContain('💳 Nubank');
    expect(card).toContain('Limite:');
    expect(card).toContain('Fecha: dia 22');
    expect(card).toContain('Vence: dia 29');
  });
});

describe('buildCartoesList', () => {
  it('explica como cadastrar quando vazio', () => {
    expect(buildCartoesList([])).toContain('cartão Nubank limite 5000');
  });
});

describe('buildLimitesCard', () => {
  it('mostra usado e disponível', () => {
    const card = buildLimitesCard([
      {
        name: 'Santander',
        creditLimit: 18000,
        used: 2000,
        available: 16000,
      },
    ]);

    expect(card).toContain('Santander');
    expect(card).toContain('Usado:');
    expect(card).toContain('Disponível:');
    expect(card).toContain('Total limite:');
    expect(card).toContain('Total usado:');
    expect(card).toContain('Total disponível:');
  });
});
