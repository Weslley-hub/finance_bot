import { TransactionsService } from './transactions.service';

describe('TransactionsService auditoria', () => {
  const existing = {
    id: 'tx-1',
    familyId: 'fam-1',
    userId: 'wes',
    type: 'EXPENSE',
    amount: 45,
    description: 'Almoço',
    merchant: null,
    categoryId: 'cat-1',
    subcategoryId: null,
    transactionDate: new Date(2026, 7, 31),
    cardInvoiceId: null,
    deletedAt: null,
  };

  function setup() {
    const prisma = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({
          ...existing,
          deletedAt: new Date(),
        }),
        create: jest.fn(),
      },
      transactionHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      cardInvoice: {
        findUnique: jest.fn(),
      },
    };
    const service = new TransactionsService(prisma as never);
    return { service, prisma };
  }

  it('arquiva a movimentação e grava quem alterou, valor anterior e data', async () => {
    const { service, prisma } = setup();

    await service.delete('tx-1', 'ana');

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.transactionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: 'tx-1',
          familyId: 'fam-1',
          changedById: 'ana',
          action: 'DELETED',
          previousValue: expect.objectContaining({
            amount: 45,
            description: 'Almoço',
          }),
        }),
      }),
    );
  });
});
