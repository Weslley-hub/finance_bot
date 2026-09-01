import { buildExtratoCard } from './extrato-card';

describe('buildExtratoCard', () => {
  it('monta o histórico do épico', () => {
    const card = buildExtratoCard([
      {
        at: new Date(2026, 7, 31),
        emoji: '🛒',
        name: 'Mercado',
        amount: 350,
        type: 'EXPENSE',
      },
      {
        at: new Date(2026, 7, 31),
        emoji: '⛽',
        name: 'Combustível',
        amount: 100,
        type: 'EXPENSE',
      },
      {
        at: new Date(2026, 7, 30),
        emoji: '💵',
        name: 'Salário',
        amount: 5000,
        type: 'INCOME',
      },
      {
        at: new Date(2026, 7, 30),
        emoji: '🍔',
        name: 'Restaurante',
        amount: 80,
        type: 'EXPENSE',
      },
    ]);

    expect(card).toContain('31/08');
    expect(card).toContain('🛒 Mercado');
    expect(card).toContain('-350');
    expect(card).toContain('⛽ Combustível');
    expect(card).toContain('-100');
    expect(card).toContain('💵 Salário');
    expect(card).toContain('+5000');
    expect(card).toContain('🍔 Restaurante');
    expect(card).toContain('-80');
  });

  it('avisa quando não há lançamentos', () => {
    expect(buildExtratoCard([])).toBe('Nenhum lançamento neste período.');
  });
});
