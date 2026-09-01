import { buildDuplicateCard } from './duplicate-card';

describe('buildDuplicateCard', () => {
  it('monta o aviso do épico', () => {
    const card = buildDuplicateCard({
      id: 'tx-1',
      title: 'Mercado',
      amount: 350,
      createdAt: new Date(2026, 7, 31),
    });

    expect(card).toBe(
      [
        '⚠️ Possível duplicidade',
        '',
        'Já existe:',
        '',
        'Mercado',
        formatExpect(350),
        '31/08',
        '',
        'Deseja adicionar mesmo assim?',
      ].join('\n'),
    );
  });
});

function formatExpect(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
