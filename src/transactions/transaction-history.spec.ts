import {
  formatHistoryLine,
  transactionSnapshot,
} from './transaction-history';

describe('transactionSnapshot', () => {
  it('guarda valor, descrição e data', () => {
    expect(
      transactionSnapshot({
        amount: 45.5,
        type: 'EXPENSE',
        description: 'Almoço',
        merchant: 'Padaria',
        categoryId: 'cat-almoco',
        subcategoryId: null,
        transactionDate: new Date(2026, 7, 31, 13, 0),
      }),
    ).toMatchObject({
      amount: 45.5,
      description: 'Almoço',
      merchant: 'Padaria',
    });
  });
});

describe('formatHistoryLine', () => {
  const previous = transactionSnapshot({
    amount: 45,
    type: 'EXPENSE',
    description: 'Almoço',
    categoryId: 'cat-1',
    transactionDate: new Date(2026, 7, 31),
  });
  const next = { ...previous, amount: 50 };

  it('mostra quem registrou', () => {
    const text = formatHistoryLine({
      action: 'CREATED',
      changedByName: 'Weslley Silva',
      previousValue: null,
      newValue: previous,
      createdAt: new Date(2026, 7, 31, 13, 40),
    });
    expect(text).toContain('Weslley registrou Almoço');
    expect(text).toContain('R$');
  });

  it('mostra valor anterior e novo na alteração', () => {
    const text = formatHistoryLine({
      action: 'UPDATED',
      changedByName: 'Ana Costa',
      previousValue: previous,
      newValue: next,
      createdAt: new Date(2026, 7, 31, 14, 0),
    });
    expect(text).toContain('Ana alterou Almoço');
    expect(text).toMatch(/45/);
    expect(text).toMatch(/50/);
  });

  it('mostra arquivamento em vez de exclusão definitiva', () => {
    const text = formatHistoryLine({
      action: 'DELETED',
      changedByName: 'Ana',
      previousValue: previous,
      newValue: null,
      createdAt: new Date(2026, 7, 31, 15, 0),
    });
    expect(text).toContain('Ana arquivou Almoço');
  });
});
