import {
  buildBudgetWarningCard,
  buildOrcamentoCard,
  isBudgetNear,
} from './orcamento-card';

describe('isBudgetNear', () => {
  it('avisa a 80% do limite', () => {
    expect(isBudgetNear(1050, 1200)).toBe(true);
    expect(isBudgetNear(960, 1200)).toBe(true);
    expect(isBudgetNear(500, 1200)).toBe(false);
  });

  it('avisa quando estoura', () => {
    expect(isBudgetNear(1300, 1200)).toBe(true);
  });
});

describe('buildOrcamentoCard', () => {
  it('lista limites mensais', () => {
    const card = buildOrcamentoCard([
      { name: 'Mercado', amount: 1200 },
      { name: 'Restaurante', amount: 500 },
      { name: 'Lazer', amount: 400 },
    ]);

    expect(card).toContain('Mercado');
    expect(card).toContain('/mês');
    expect(card).toContain('Restaurante');
    expect(card).toContain('Lazer');
  });

  it('explica como definir quando vazio', () => {
    expect(buildOrcamentoCard([])).toContain('orçamento mercado 1200');
  });
});

describe('buildBudgetWarningCard', () => {
  it('mostra gasto, limite e restante', () => {
    const card = buildBudgetWarningCard({
      name: 'Mercado',
      spent: 1050,
      amount: 1200,
      remaining: 150,
    });

    expect(card).toContain('⚠️ Mercado');
    expect(card).toContain('Vocês já gastaram:');
    expect(card).toContain('Orçamento:');
    expect(card).toContain('Restam:');
  });

  it('mostra quando passou do limite', () => {
    const card = buildBudgetWarningCard({
      name: 'Mercado',
      spent: 1350,
      amount: 1200,
      remaining: -150,
    });

    expect(card).toContain('Passou:');
  });
});
