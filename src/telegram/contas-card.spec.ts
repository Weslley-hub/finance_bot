import { buildContasCard } from './contas-card';

describe('buildContasCard', () => {
  it('monta o resumo do mês com pagos e pendentes', () => {
    const card = buildContasCard(8, [
      {
        status: 'PAID',
        supplier: 'Vivo',
        amount: 119.9,
        dueDate: new Date(2026, 8, 5),
        category: { slug: 'internet', name: 'Internet' },
      },
      {
        status: 'PENDING',
        supplier: 'Enel',
        amount: 238.72,
        dueDate: new Date(2026, 8, 12),
        category: { slug: 'energia', name: 'Energia' },
      },
      {
        status: 'PENDING',
        supplier: 'Terreno',
        amount: 292.8,
        dueDate: new Date(2026, 8, 10),
        category: { slug: 'outros', name: 'Outros' },
      },
      {
        status: 'PENDING',
        supplier: 'Sabesp',
        amount: 84.2,
        dueDate: new Date(2026, 8, 15),
        category: { slug: 'agua', name: 'Água' },
      },
    ]);

    expect(card).toContain('📅 CONTAS — SETEMBRO');
    expect(card).toContain('✅ Internet');
    expect(card).toContain('⏳ Energia');
    expect(card).toContain('12/09');
    expect(card).toContain('⏳ Terreno');
    expect(card).toContain('10/09');
    expect(card).toContain('⏳ Água');
    expect(card).toContain('15/09');
    expect(card).toContain('Pago:');
    expect(card).toContain('Pendente:');
    expect(card.indexOf('✅ Internet')).toBeLessThan(card.indexOf('⏳ Terreno'));
    expect(card.indexOf('⏳ Terreno')).toBeLessThan(card.indexOf('⏳ Energia'));
  });

  it('avisa quando não há contas', () => {
    const card = buildContasCard(7, []);
    expect(card).toContain('📅 CONTAS — AGOSTO');
    expect(card).toContain('Nenhuma conta neste mês.');
  });
});
