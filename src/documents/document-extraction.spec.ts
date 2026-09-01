import { parseDocumentExtraction, parseReceiptText, validateExtraction, monthName, classifyDocumentType, normalizeExtraction } from './document-extraction';
import { inferMovementType, normalizePaymentType } from './payment-classification';

describe('parseDocumentExtraction', () => {
  it('lê comprovante PIX para concessionária como despesa', () => {
    const extracted = parseDocumentExtraction({
      kind: 'RECEIPT',
      amount: 230,
      date: '31/08/2026',
      paymentType: 'PIX',
      destination: 'ENEL',
      bank: 'Nubank',
    });

    expect(extracted).toMatchObject({
      kind: 'BANK_RECEIPT',
      amount: 230,
      paymentType: 'PIX',
      destination: 'ENEL',
      bank: 'Nubank',
      movementType: 'EXPENSE',
    });
    expect(extracted?.date?.getDate()).toBe(31);
    expect(extracted?.date?.getMonth()).toBe(7);
  });

  it('lê PIX Nubank → Inter como transferência', () => {
    const extracted = parseDocumentExtraction({
      kind: 'RECEIPT',
      amount: 1500,
      paymentType: 'PIX',
      originBank: 'Nubank',
      destinationBank: 'Inter',
      destination: 'Inter',
    });

    expect(extracted?.movementType).toBe('TRANSFER');
  });

  it('lê conta de energia', () => {
    const extracted = parseDocumentExtraction({
      kind: 'BILL',
      amount: '238,72',
      dueDate: '12/09/2026',
      supplier: 'Enel',
      barcode: '12345',
    });

    expect(extracted).toMatchObject({
      kind: 'BILL',
      amount: 238.72,
      supplier: 'Enel',
      barcode: '12345',
    });
    expect(extracted?.dueDate?.getDate()).toBe(12);
    expect(extracted?.dueDate?.getMonth()).toBe(8);
  });
});

describe('parseReceiptText', () => {
  it('reconhece transferência Nubank para Inter', () => {
    const extracted = parseReceiptText(`
      Comprovante de transferência PIX
      Nubank
      Para: Inter
      Valor: R$ 1.500,00
      30/08/2026
    `);

    expect(extracted).toMatchObject({
      kind: 'BANK_RECEIPT',
      amount: 1500,
      paymentType: 'PIX',
      originBank: 'Nubank',
      destinationBank: 'Inter',
      movementType: 'TRANSFER',
    });
  });

  it('reconhece PIX para Enel como despesa', () => {
    const extracted = parseReceiptText(`
      Comprovante PIX
      Nubank
      Para: Enel São Paulo
      Valor: R$ 230,00
    `);

    expect(extracted?.movementType).toBe('EXPENSE');
    expect(extracted?.amount).toBe(230);
    expect(extracted?.paymentType).toBe('PIX');
  });

  it('reconhece TED entre bancos como transferência', () => {
    const extracted = parseReceiptText(`
      Comprovante de TED
      Bradesco
      Para: Itaú
      Valor: R$ 2.000,00
    `);

    expect(extracted).toMatchObject({
      paymentType: 'TED',
      originBank: 'Bradesco',
      destinationBank: 'Itaú',
      movementType: 'TRANSFER',
      amount: 2000,
    });
  });

  it('reconhece boleto pago como despesa', () => {
    const extracted = parseReceiptText(`
      Pagamento de boleto
      Enel São Paulo
      Valor: R$ 238,72
    `);

    expect(extracted?.paymentType).toBe('BOLETO');
    expect(extracted?.movementType).toBe('EXPENSE');
    expect(extracted?.amount).toBe(238.72);
  });

  it('reconhece pagamento no cartão como despesa', () => {
    const extracted = parseReceiptText(`
      Comprovante de cartão de crédito
      Extra Hipermercado
      Valor: R$ 89,90
    `);

    expect(extracted?.paymentType).toBe('CARD');
    expect(extracted?.movementType).toBe('EXPENSE');
    expect(extracted?.amount).toBe(89.9);
  });

  it('reconhece comprovante de pagamento a comércio como despesa', () => {
    const extracted = parseReceiptText(`
      Comprovante de pagamento
      Padaria Central
      Valor: R$ 32,00
    `);

    expect(extracted?.paymentType).toBe('PAYMENT');
    expect(extracted?.movementType).toBe('EXPENSE');
  });
});

describe('validateExtraction', () => {
  it('reclassifica Nubank → Inter como TRANSFER', () => {
    const parsed = parseDocumentExtraction({
      kind: 'RECEIPT',
      amount: 500,
      paymentType: 'PIX',
      originBank: 'Nubank',
      destinationBank: 'Inter',
      movementType: 'EXPENSE',
    });

    const validated = validateExtraction(parsed!);
    expect(validated.valid).toBe(true);
    expect(validated.extraction.movementType).toBe('TRANSFER');
  });
});

describe('normalizePaymentType', () => {
  it.each([
    ['Pix enviado', 'PIX'],
    ['TED', 'TED'],
    ['pagamento de boleto', 'BOLETO'],
    ['cartão de crédito', 'CARD'],
    ['transferência', 'TRANSFER'],
    ['comprovante de pagamento', 'PAYMENT'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizePaymentType(input)).toBe(expected);
  });
});

describe('monthName', () => {
  it('nomeia setembro', () => {
    expect(monthName(8)).toBe('setembro');
  });
});

describe('inferMovementType', () => {
  it('não trata internet como banco Inter', () => {
    expect(
      inferMovementType({
        text: 'paguei 120 de internet',
        paymentType: 'PAYMENT',
      }),
    ).toBe('EXPENSE');
  });

  it('trata PIX para o Inter como transferência', () => {
    expect(
      inferMovementType({
        text: 'fiz um pix de 500 para o Inter',
        paymentType: 'PIX',
      }),
    ).toBe('TRANSFER');
  });
});

describe('classifyDocumentType', () => {
  it('marca PIX como comprovante bancário', () => {
    expect(classifyDocumentType({ paymentType: 'PIX' })).toBe('BANK_RECEIPT');
  });

  it('marca fatura de cartão', () => {
    expect(
      classifyDocumentType({
        fileName: 'fatura-nubank-agosto.pdf',
        looksLikeInvoice: true,
      }),
    ).toBe('INVOICE');
  });

  it('marca extrato bancário', () => {
    expect(
      classifyDocumentType({
        text: 'extrato conta corrente saldo lançamentos',
      }),
    ).toBe('BANK_STATEMENT');
  });

  it('marca conta com vencimento', () => {
    expect(
      classifyDocumentType({
        text: 'conta de energia vencimento 12/09',
        looksLikeBill: true,
      }),
    ).toBe('BILL');
  });
});

describe('normalizeExtraction', () => {
  it('arredonda valor e limpa rótulos', () => {
    const normalized = normalizeExtraction({
      kind: 'RECEIPT',
      amount: 230.006,
      date: null,
      dueDate: null,
      paymentType: 'PIX',
      movementType: 'EXPENSE',
      originBank: '  Nubank  ',
      destinationBank: null,
      destination: '  Enel   São Paulo ',
      supplier: null,
      bank: ' Nubank ',
      barcode: null,
      description: '  comprovante  ',
    });

    expect(normalized.amount).toBe(230.01);
    expect(normalized.destination).toBe('Enel São Paulo');
    expect(normalized.originBank).toBe('Nubank');
    expect(normalized.kind).toBe('BANK_RECEIPT');
  });
});
