import { pickDuplicate } from './duplicate';

const today = new Date(2026, 7, 31, 12, 0, 0);

describe('pickDuplicate', () => {
  const mercado = {
    id: 'tx-1',
    userId: 'user-1',
    type: 'EXPENSE' as const,
    amount: 350,
    createdAt: today,
    description: 'Mercado',
    merchant: 'MERCADO',
    rawText: 'mercado 350',
    categoryId: 'cat-mercado',
    categoryName: 'Mercado',
  };

  it('detecta comprovante do mesmo mercado no mesmo dia', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-1',
        type: 'EXPENSE',
        amount: 350,
        at: today,
        description: 'Pagamento',
        merchant: 'Extra Hipermercado',
        rawText: 'comprovante PIX Extra Hipermercado',
        categoryId: 'cat-mercado',
        paymentType: 'PIX',
      },
      [mercado],
    );

    expect(hit).toMatchObject({
      id: 'tx-1',
      title: 'Mercado',
      amount: 350,
    });
  });

  it('detecta Extra Hipermercado mesmo em outra categoria', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-1',
        type: 'EXPENSE',
        amount: 350,
        at: today,
        description: 'Pagamento',
        merchant: 'Extra Hipermercado',
        rawText: 'comprovante PIX Extra Hipermercado',
        categoryId: 'cat-outros',
        paymentType: 'PIX',
      },
      [mercado],
    );

    expect(hit?.title).toBe('Mercado');
  });

  it('detecta comprovante genérico depois do texto mercado 350', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-1',
        type: 'EXPENSE',
        amount: 350,
        at: today,
        description: 'Pagamento',
        merchant: null,
        rawText: 'comprovante PIX Pagamento',
        categoryId: 'cat-outros',
        paymentType: 'PIX',
      },
      [mercado],
    );

    expect(hit?.title).toBe('Mercado');
  });

  it('não mistura mercado com farmácia no mesmo valor', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-1',
        type: 'EXPENSE',
        amount: 350,
        at: today,
        description: 'Farmácia',
        merchant: 'Drogasil',
        rawText: 'farmacia 350',
        categoryId: 'cat-farmacia',
      },
      [mercado],
    );

    expect(hit).toBeNull();
  });

  it('não mistura outro usuário', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-2',
        type: 'EXPENSE',
        amount: 350,
        at: today,
        description: 'Mercado',
        merchant: 'MERCADO',
        rawText: 'mercado 350',
        categoryId: 'cat-mercado',
      },
      [mercado],
    );

    expect(hit).toBeNull();
  });

  it('não mistura outro dia', () => {
    const hit = pickDuplicate(
      {
        userId: 'user-1',
        type: 'EXPENSE',
        amount: 350,
        at: new Date(2026, 8, 2, 12, 0, 0),
        description: 'Mercado',
        rawText: 'mercado 350',
        categoryId: 'cat-mercado',
      },
      [mercado],
    );

    expect(hit).toBeNull();
  });
});
