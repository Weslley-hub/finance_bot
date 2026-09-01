import { buildPayableCard, sumPayables } from './payable-card';

describe('sumPayables', () => {
  it('soma as quatro origens', () => {
    expect(
      sumPayables({
        bills: 200,
        invoice: 800,
        installments: 240,
        recurrences: 292.8,
        recurrenceLines: [],
        overdueLines: [],
      }),
    ).toEqual({
      bills: 200,
      invoice: 800,
      installments: 240,
      recurrences: 292.8,
      recurrenceLines: [],
      overdueLines: [],
      total: 1532.8,
    });
  });
});

describe('buildPayableCard', () => {
  it('lista contas, fatura, parcelas e recorrências', () => {
    const card = buildPayableCard({
      bills: 200,
      invoice: 800,
      installments: 240,
      recurrences: 120,
      recurrenceLines: [],
      overdueLines: [],
      total: 1360,
    });

    expect(card).toContain('Ainda para pagar');
    expect(card).toContain('Contas pendentes');
    expect(card).toContain('Fatura');
    expect(card).toContain('Parcelas');
    expect(card).toContain('Recorrências');
    expect(card).toContain('Total');
  });

  it('detalha recorrências e atrasadas', () => {
    const card = buildPayableCard({
      bills: 0,
      invoice: 0,
      installments: 0,
      recurrences: 578,
      recurrenceLines: [{ label: 'Terreno · setembro', amount: 289 }],
      overdueLines: [{ label: 'Terreno · agosto', amount: 289 }],
      total: 578,
    });
    expect(card).toContain('Terreno · setembro');
    expect(card).toContain('Atrasadas');
    expect(card).toContain('Terreno · agosto');
    expect(card).not.toMatch(/Recorrências\nR\$\s*578/);
  });

  it('não repete o valor atrasado em Recorrências', () => {
    const card = buildPayableCard({
      bills: 0,
      invoice: 0,
      installments: 0,
      recurrences: 289,
      recurrenceLines: [],
      overdueLines: [{ label: 'Terreno · agosto', amount: 289 }],
      total: 289,
    });
    expect(card).toContain('Atrasadas');
    expect(card).toContain('Terreno · agosto');
    expect(card).toMatch(/Recorrências\nR\$\s*0/);
  });
});
