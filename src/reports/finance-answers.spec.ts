import {
  buildCompareAnswer,
  buildSpendAnswer,
  buildTopCategoriesAnswer,
  buildTopExpensesAnswer,
} from './finance-answers';

describe('buildSpendAnswer', () => {
  it('responde gasto por categoria', () => {
    const text = buildSpendAnswer({
      who: 'A família',
      amount: 1423,
      category: { emoji: '🛒', name: 'Mercado' },
      months: 1,
    });

    expect(text).toContain('🛒 Mercado');
    expect(text).toContain('A família gastou');
    expect(text).toContain('neste mês');
  });

  it('responde gasto pessoal', () => {
    expect(
      buildSpendAnswer({
        who: 'Você',
        amount: 200,
        months: 1,
      }),
    ).toContain('Você gastou');
  });

  it('responde gasto da família no plural', () => {
    expect(
      buildSpendAnswer({
        who: 'Vocês',
        amount: 800,
        months: 1,
      }),
    ).toContain('Vocês gastaram');
  });
});

describe('buildCompareAnswer', () => {
  it('diz quando gastaram mais', () => {
    const text = buildCompareAnswer(4200, 3800);
    expect(text).toContain('Este mês:');
    expect(text).toContain('Mês passado:');
    expect(text).toContain('a mais que no mês passado');
  });

  it('diz quando gastaram menos', () => {
    expect(buildCompareAnswer(100, 300)).toContain(
      'a menos que no mês passado',
    );
  });
});

describe('buildTopCategoriesAnswer', () => {
  it('inclui ranking', () => {
    const text = buildTopCategoriesAnswer(
      [{ emoji: '🛒', name: 'Mercado', amount: 1423, percent: 23 }],
      1,
    );
    expect(text).toContain('Onde vocês mais gastam neste mês');
    expect(text).toContain('🛒 Mercado');
  });
});

describe('buildTopExpensesAnswer', () => {
  it('lista as maiores despesas', () => {
    const text = buildTopExpensesAnswer(
      [{ emoji: '🛒', description: 'Mercado', amount: 350 }],
      1,
    );
    expect(text).toContain('Maiores despesas neste mês');
    expect(text).toContain('1. 🛒 Mercado');
  });
});
