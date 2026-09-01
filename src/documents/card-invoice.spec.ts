import {
  countInvoiceItems,
  inferCardName,
  inferInvoiceDate,
  invoiceItemStatus,
  looksLikeCardInvoice,
  parseCardInvoiceItems,
} from './card-invoice';

const SAMPLE = `
Fatura Nubank — agosto
Uber R$ 32
iFood R$ 76
Posto R$ 190
Amazon R$ 129
Netflix R$ 55
`;

describe('parseCardInvoiceItems', () => {
  it('lê os lançamentos do épico', () => {
    expect(parseCardInvoiceItems(SAMPLE)).toEqual([
      { merchant: 'Uber', amount: 32, date: null },
      { merchant: 'iFood', amount: 76, date: null },
      { merchant: 'Posto', amount: 190, date: null },
      { merchant: 'Amazon', amount: 129, date: null },
      { merchant: 'Netflix', amount: 55, date: null },
    ]);
  });

  it('lê linhas no formato da fatura Nubank', () => {
    const items = parseCardInvoiceItems(`
      FATURA NUBANK AGOSTO
      05 AGO Uber *Uber *Trip 32,00
      07 AGO IFOOD *IFOOD 76,00
      Valor total R$ 482,00
      Pagamento recebido 1.200,00
    `);

    expect(items).toEqual([
      { merchant: 'Uber Trip', amount: 32, date: null },
      { merchant: 'IFOOD', amount: 76, date: null },
    ]);
  });

  it('lê valor na linha seguinte', () => {
    const items = parseCardInvoiceItems(`
      Fatura Nubank
      Posto Shell
      R$ 190,00
    `);

    expect(items).toEqual([
      { merchant: 'Posto Shell', amount: 190, date: null },
    ]);
  });
});

describe('looksLikeCardInvoice', () => {
  it('reconhece pelo nome do arquivo', () => {
    expect(
      looksLikeCardInvoice(SAMPLE, 'fatura-nubank-agosto.pdf'),
    ).toBe(true);
  });

  it('não trata conta de luz como fatura de cartão', () => {
    expect(
      looksLikeCardInvoice(
        'Conta de energia Enel Vencimento 12/09 Valor R$ 238,72',
        'conta-enel.pdf',
      ),
    ).toBe(false);
  });
});

describe('inferCardName', () => {
  it('tira o banco do nome do arquivo', () => {
    expect(inferCardName('fatura-nubank-agosto.pdf')).toBe('Nubank');
  });
});

describe('inferInvoiceDate', () => {
  it('usa o mês do arquivo', () => {
    const date = inferInvoiceDate(
      'fatura-nubank-agosto.pdf',
      '',
      new Date(2026, 7, 31),
    );
    expect(date.getMonth()).toBe(7);
    expect(date.getFullYear()).toBe(2026);
  });
});

describe('invoiceItemStatus', () => {
  it('separa reconhecidas, revisão e duplicadas', () => {
    expect(invoiceItemStatus(0.9, false)).toBe('recognized');
    expect(invoiceItemStatus(0.2, false)).toBe('review');
    expect(invoiceItemStatus(0.9, true)).toBe('duplicate');
  });
});

describe('countInvoiceItems', () => {
  it('fecha a conta do cartão do épico', () => {
    const counts = countInvoiceItems([
      ...Array.from({ length: 39 }, () => ({ status: 'recognized' as const })),
      ...Array.from({ length: 6 }, () => ({ status: 'review' as const })),
      ...Array.from({ length: 2 }, () => ({ status: 'duplicate' as const })),
    ]);

    expect(counts).toEqual({
      total: 47,
      recognized: 39,
      review: 6,
      duplicates: 2,
    });
  });
});
