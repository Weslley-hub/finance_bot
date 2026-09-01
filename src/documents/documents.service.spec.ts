import { DocumentExtraction } from './document-extraction';
import { PipelineResult } from './document-pipeline.service';
import { DocumentsService, IngestInput } from './documents.service';

function extraction(
  overrides: Partial<DocumentExtraction> = {},
): DocumentExtraction {
  return {
    kind: 'BANK_RECEIPT',
    amount: 230,
    date: new Date(2026, 7, 31),
    dueDate: null,
    paymentType: 'PIX',
    movementType: 'EXPENSE',
    originBank: 'Nubank',
    destinationBank: null,
    destination: 'Enel',
    supplier: null,
    bank: 'Nubank',
    barcode: null,
    description: null,
    ...overrides,
  };
}

function pipelineResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  const extracted = overrides.extraction ?? extraction();
  return {
    extraction: extracted,
    validation: { valid: true, errors: [], extraction: extracted },
    source: 'RULE',
    extractedText: 'PIX Enel R$ 230,00',
    scannedPdf: false,
    invoiceItems: [],
    looksLikeInvoice: false,
    ...overrides,
  };
}

describe('DocumentsService.ingest', () => {
  const input: IngestInput = {
    familyId: 'fam-1',
    userId: 'user-1',
    telegramFileId: 'file-1',
    buffer: Buffer.from('img'),
    mimeType: 'image/jpeg',
    isPdf: false,
  };

  const document = {
    id: 'doc-1',
    familyId: 'fam-1',
    userId: 'user-1',
  };

  function setup() {
    const prisma = {
      document: {
        create: jest.fn().mockResolvedValue(document),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...document,
          ...data,
        })),
      },
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cat-energia',
          emoji: '⚡',
          name: 'Energia',
          parent: null,
        }),
      },
    };
    const pipeline = {
      extract: jest.fn(),
      classify: jest.fn(),
      normalize: jest.fn(),
    };
    const engine = {
      categorize: jest.fn().mockResolvedValue({
        categoryId: 'cat-energia',
        categoryName: 'Energia',
        description: 'Enel',
        source: 'RULE',
        confidence: 0.9,
      }),
    };
    const categories = {
      findBySlug: jest.fn().mockResolvedValue({
        id: 'cat-outros',
        emoji: '📦',
        name: 'Outros',
        parent: null,
      }),
    };
    const transactions = {
      findPossibleDuplicate: jest.fn().mockResolvedValue(null),
    };

    const service = new DocumentsService(
      prisma as never,
      pipeline as never,
      engine as never,
      categories as never,
      transactions as never,
    );

    return { service, prisma, pipeline, engine, categories, transactions };
  }

  it('classifica, normaliza, categoriza e detecta duplicidade do comprovante', async () => {
    const { service, pipeline, engine, transactions, prisma } = setup();
    const extracted = pipelineResult();
    const classified = pipelineResult({ extraction: extraction({ kind: 'BANK_RECEIPT' }) });
    const normalized = pipelineResult({
      extraction: extraction({ kind: 'BANK_RECEIPT', amount: 230.01 }),
    });
    pipeline.extract.mockResolvedValue(extracted);
    pipeline.classify.mockReturnValue(classified);
    pipeline.normalize.mockReturnValue(normalized);
    transactions.findPossibleDuplicate.mockResolvedValue({
      id: 'tx-dup',
      title: 'Enel',
      amount: 230,
      createdAt: new Date(),
    });

    const result = await service.ingest(input);

    expect(pipeline.extract).toHaveBeenCalledWith(input);
    expect(pipeline.classify).toHaveBeenCalledWith(extracted, input);
    expect(pipeline.normalize).toHaveBeenCalledWith(classified, input);
    expect(engine.categorize).toHaveBeenCalledWith({
      text: 'gastei 230.01 Enel',
      familyId: 'fam-1',
    });
    expect(transactions.findPossibleDuplicate).toHaveBeenCalled();
    expect(result.status).toBe('receipt');
    if (result.status === 'receipt') {
      expect(result.duplicate?.id).toBe('tx-dup');
      expect(result.category.id).toBe('cat-energia');
    }
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'BANK_RECEIPT',
          status: 'REVIEW',
        }),
      }),
    );
  });

  it('não busca duplicata em transferência', async () => {
    const { service, pipeline, transactions } = setup();
    const pix = extraction({
      movementType: 'TRANSFER',
      originBank: 'Nubank',
      destinationBank: 'Inter',
      destination: 'Inter',
    });
    const resultPayload = pipelineResult({ extraction: pix });
    pipeline.extract.mockResolvedValue(resultPayload);
    pipeline.classify.mockReturnValue(resultPayload);
    pipeline.normalize.mockReturnValue(resultPayload);

    const result = await service.ingest(input);

    expect(transactions.findPossibleDuplicate).not.toHaveBeenCalled();
    expect(result.status).toBe('receipt');
    if (result.status === 'receipt') {
      expect(result.duplicate).toBeNull();
      expect(result.category.id).toBe('cat-outros');
    }
  });

  it('categoriza linhas da fatura e marca REVIEW', async () => {
    const { service, pipeline, engine, prisma } = setup();
    const invoice = pipelineResult({
      looksLikeInvoice: true,
      extractedText: 'fatura nubank',
      invoiceItems: [
        { merchant: 'Amazon', amount: 50, date: null },
        { merchant: 'Uber', amount: 22, date: null },
      ],
    });
    pipeline.extract.mockResolvedValue(invoice);
    pipeline.classify.mockReturnValue(invoice);
    pipeline.normalize.mockReturnValue(invoice);

    const result = await service.ingest({
      ...input,
      isPdf: true,
      fileName: 'fatura-nubank.pdf',
    });

    expect(engine.categorize).toHaveBeenNthCalledWith(1, {
      text: 'gastei 50 Amazon',
      familyId: 'fam-1',
    });
    expect(result.status).toBe('invoice');
    if (result.status === 'invoice') {
      expect(result.items).toHaveLength(2);
    }
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'INVOICE', status: 'REVIEW' }),
      }),
    );
  });

  it('marca PDF escaneado como FAILED', async () => {
    const { service, pipeline, prisma, engine } = setup();
    const scanned = pipelineResult({
      scannedPdf: true,
      extraction: null,
      validation: null,
      extractedText: '',
    });
    pipeline.extract.mockResolvedValue(scanned);
    pipeline.classify.mockReturnValue(scanned);
    pipeline.normalize.mockReturnValue(scanned);

    const result = await service.ingest({ ...input, isPdf: true });

    expect(engine.categorize).not.toHaveBeenCalled();
    expect(result.status).toBe('scanned_pdf');
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('recusa comprovante, PDF ou imagem em URL pública', () => {
    const { service, prisma } = setup();

    expect(() =>
      service.create({
        familyId: 'fam-1',
        userId: 'user-1',
        telegramFileId: 'file-1',
        type: 'UNKNOWN',
        storagePath: 'https://cdn.example.com/comprovante.jpg',
      }),
    ).toThrow(/URL pública/);

    expect(prisma.document.create).not.toHaveBeenCalled();
  });
});
