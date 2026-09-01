import {
  buildInvoiceImportCard,
  buildInvoicePreviewCard,
  buildInvoiceReviewCard,
} from './invoice-card';

describe('buildInvoicePreviewCard', () => {
  it('monta o resumo do épico', () => {
    expect(
      buildInvoicePreviewCard({
        total: 47,
        recognized: 39,
        review: 6,
        duplicates: 2,
      }),
    ).toBe(
      [
        'Encontrei 47 transações.',
        '',
        '39 reconhecidas',
        '6 precisam de revisão',
        '2 parecem duplicadas',
      ].join('\n'),
    );
  });
});

describe('buildInvoiceReviewCard', () => {
  it('lista o que falta revisar', () => {
    const card = buildInvoiceReviewCard([
      {
        merchant: 'Loja XYZ',
        amount: 40,
        categoryName: '📦 Outros',
        status: 'review',
      },
      {
        merchant: 'Uber',
        amount: 32,
        categoryName: '🚕 Uber',
        status: 'duplicate',
      },
    ]);

    expect(card).toContain('Precisam de revisão:');
    expect(card).toContain('Loja XYZ');
    expect(card).toContain('Parecem duplicadas:');
    expect(card).toContain('Uber');
  });
});

describe('buildInvoiceImportCard', () => {
  it('resume o que entrou', () => {
    const card = buildInvoiceImportCard(
      'Nubank',
      { total: 47, recognized: 39, review: 6, duplicates: 2 },
      39,
    );

    expect(card).toContain('Importei 39 lançamentos da fatura Nubank.');
    expect(card).toContain('precisam de revisão');
    expect(card).toContain('duplicadas ignoradas');
  });
});
