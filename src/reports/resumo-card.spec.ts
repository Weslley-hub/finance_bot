import { buildResumoCard } from './resumo-card';

describe('buildResumoCard', () => {
  it('monta o resumo do mês', () => {
    const card = buildResumoCard({
      monthIndex: 7,
      year: 2026,
      income: 9500,
      expenses: 6240,
      balance: 3260,
      pendingBills: 640,
      projected: 2620,
    });

    expect(card).toContain('📊 AGOSTO/2026');
    expect(card).toContain('Receitas');
    expect(card).toContain('Despesas');
    expect(card).toContain('Saldo');
    expect(card).toContain('Contas pendentes');
    expect(card).toContain('Saldo projetado');
  });
});
