import { Injectable } from '@nestjs/common';
import {
  CategorizationSource,
  Document,
  DocumentStatus,
  DocumentType,
  Prisma,
} from '@prisma/client';
import { CategorizationEngine } from '../categories/categorization.engine';
import { CategoriesService } from '../categories/categories.service';
import { matchCategoryKeyword } from '../categories/match-category-keywords';
import { PrismaService } from '../common/prisma/prisma.service';
import { assertPrivateStoragePath } from '../common/security/private-files';
import { DuplicateHit } from '../transactions/duplicate';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CardInvoiceLine,
  inferCardName,
  inferInvoiceDate,
  invoiceItemStatus,
  InvoiceItemStatus,
} from './card-invoice';
import {
  DocumentExtraction,
  extractionToJson,
} from './document-extraction';
import { DocumentPipelineService } from './document-pipeline.service';

export type IngestInput = {
  familyId: string;
  userId: string;
  telegramFileId: string;
  buffer: Buffer;
  mimeType: string;
  caption?: string;
  fileName?: string;
  isPdf: boolean;
};

export type CategoryHint = {
  id: string;
  emoji: string;
  name: string;
};

export type InvoicePipelineItem = {
  merchant: string;
  amount: number;
  date: Date | null;
  categoryId: string;
  categoryName: string;
  description: string;
  source: CategorizationSource;
  confidence: number;
  status: InvoiceItemStatus;
};

export type IngestResult =
  | { status: 'scanned_pdf'; document: Document }
  | { status: 'failed'; document: Document; errors: string[] }
  | { status: 'bank_statement'; document: Document }
  | {
      status: 'invoice';
      document: Document;
      cardName: string;
      fileName?: string;
      items: InvoicePipelineItem[];
    }
  | {
      status: 'bill';
      document: Document;
      extraction: DocumentExtraction;
      category: CategoryHint;
      categorizationSource: CategorizationSource;
    }
  | {
      status: 'receipt';
      document: Document;
      extraction: DocumentExtraction;
      category: CategoryHint;
      categorizationSource: CategorizationSource;
      confidence: number;
      duplicate: DuplicateHit | null;
    };

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: DocumentPipelineService,
    private readonly engine: CategorizationEngine,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
  ) {}

  markProcessed(id: string) {
    return this.prisma.document.update({
      where: { id },
      data: { status: 'PROCESSED' },
    });
  }

  create(data: {
    familyId: string;
    userId: string;
    telegramFileId: string;
    type: DocumentType;
    storagePath?: string;
    extractedText?: string;
    parsedData?: Prisma.InputJsonValue;
    status?: DocumentStatus;
  }) {
    assertPrivateStoragePath(data.storagePath);
    return this.prisma.document.create({
      data: {
        familyId: data.familyId,
        userId: data.userId,
        telegramFileId: data.telegramFileId,
        type: data.type,
        storagePath: data.storagePath,
        extractedText: data.extractedText,
        parsedData: data.parsedData,
        status: data.status ?? 'PENDING',
      },
    });
  }

  async ingest(input: IngestInput): Promise<IngestResult> {
    const document = await this.create({
      familyId: input.familyId,
      userId: input.userId,
      telegramFileId: input.telegramFileId,
      type: 'UNKNOWN',
      extractedText: input.caption,
      status: 'PENDING',
    });

    try {
      const extracted = await this.pipeline.extract(input);
      const classified = this.pipeline.classify(extracted, input);
      const normalized = this.pipeline.normalize(classified, input);

      if (normalized.scannedPdf) {
        return this.finish(document.id, {
          type: 'UNKNOWN',
          extractedText: normalized.extractedText || input.caption,
          status: 'FAILED',
        }, { status: 'scanned_pdf', document });
      }

      if (normalized.looksLikeInvoice && normalized.invoiceItems.length >= 2) {
        return this.finishInvoice(document, input, normalized.extractedText, normalized.invoiceItems);
      }

      const extraction = normalized.extraction;
      if (extraction?.kind === 'BANK_STATEMENT') {
        return this.finish(document.id, {
          type: 'BANK_STATEMENT',
          extractedText: normalized.extractedText || input.caption,
          parsedData: extractionToJson(extraction),
          status: 'PENDING',
        }, { status: 'bank_statement', document });
      }

      if (!extraction || !extraction.amount) {
        return this.finish(document.id, {
          type: extraction?.kind ?? 'UNKNOWN',
          extractedText: normalized.extractedText || input.caption,
          parsedData: extraction ? extractionToJson(extraction) : undefined,
          status: 'FAILED',
        }, {
          status: 'failed',
          document,
          errors: normalized.validation?.errors ?? ['Não encontrei o valor.'],
        });
      }

      const categorized = await this.categorize(input.familyId, extraction, input.caption);
      const duplicate =
        extraction.movementType === 'TRANSFER'
          ? null
          : await this.detectDuplicate(input, extraction, categorized.category.id);

      const outcome: IngestResult =
        extraction.kind === 'BILL'
          ? {
              status: 'bill',
              document,
              extraction,
              category: categorized.category,
              categorizationSource: categorized.source,
            }
          : {
              status: 'receipt',
              document,
              extraction,
              category: categorized.category,
              categorizationSource: categorized.source,
              confidence: categorized.confidence,
              duplicate,
            };

      return this.finish(document.id, {
        type: extraction.kind,
        extractedText: normalized.extractedText || input.caption,
        parsedData: {
          ...extractionToJson(extraction),
          categoryId: categorized.category.id,
          duplicateId: duplicate?.id ?? null,
        },
        status: 'REVIEW',
      }, outcome);
    } catch {
      return this.finish(document.id, { status: 'FAILED' }, {
        status: 'failed',
        document,
        errors: ['Não consegui processar esse documento.'],
      });
    }
  }

  private async finishInvoice(
    document: Document,
    input: IngestInput,
    extractedText: string,
    lines: CardInvoiceLine[],
  ): Promise<IngestResult> {
    const cardName = inferCardName(input.fileName, extractedText);
    const invoiceDate = inferInvoiceDate(input.fileName, extractedText);
    const items = await this.categorizeInvoiceLines(input, lines, invoiceDate);

    if (items.length === 0) {
      return this.finish(document.id, {
        type: 'INVOICE',
        extractedText,
        status: 'FAILED',
      }, {
        status: 'failed',
        document,
        errors: ['Não consegui ler os lançamentos dessa fatura. Envie o PDF com texto selecionável.'],
      });
    }

    return this.finish(document.id, {
      type: 'INVOICE',
      extractedText,
      parsedData: {
        kind: 'INVOICE',
        cardName,
        fileName: input.fileName ?? null,
        items: items.map((item) => ({
          merchant: item.merchant,
          amount: item.amount,
          status: item.status,
        })),
      },
      status: 'REVIEW',
    }, {
      status: 'invoice',
      document,
      cardName,
      fileName: input.fileName,
      items,
    });
  }

  private async categorizeInvoiceLines(
    input: IngestInput,
    lines: CardInvoiceLine[],
    invoiceDate: Date,
  ): Promise<InvoicePipelineItem[]> {
    const items: InvoicePipelineItem[] = [];

    for (const line of lines) {
      const result = await this.engine.categorize({
        text: `gastei ${line.amount} ${line.merchant}`,
        familyId: input.familyId,
      });
      if (!result) {
        continue;
      }

      const similar = await this.transactions.findPossibleDuplicate({
        familyId: input.familyId,
        userId: input.userId,
        type: 'EXPENSE',
        amount: line.amount,
        at: line.date ?? invoiceDate,
        description: result.description,
        merchant: line.merchant,
        rawText: line.merchant,
        categoryId: result.categoryId,
      });

      items.push({
        merchant: line.merchant,
        amount: line.amount,
        date: line.date ?? invoiceDate,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        description: result.description,
        source: result.source,
        confidence: result.confidence,
        status: invoiceItemStatus(result.confidence, Boolean(similar)),
      });
    }

    return items;
  }

  private async categorize(
    familyId: string,
    extraction: DocumentExtraction,
    caption?: string,
  ): Promise<{
    category: CategoryHint;
    source: CategorizationSource;
    confidence: number;
  }> {
    if (extraction.movementType === 'TRANSFER') {
      return {
        category: await this.categoryHint('outros'),
        source: 'RULE',
        confidence: 0.92,
      };
    }

    const label =
      extraction.destination ??
      extraction.supplier ??
      extraction.description ??
      caption ??
      'pagamento';
    const amount = extraction.amount ?? 0;
    const verb = extraction.movementType === 'INCOME' ? 'recebi' : 'gastei';
    const result = await this.engine.categorize({
      text: `${verb} ${amount} ${label}`,
      familyId,
    });

    if (result) {
      const category = await this.prisma.category.findUnique({
        where: { id: result.categoryId },
        include: { parent: true },
      });
      if (category) {
        return {
          category: {
            id: category.id,
            emoji: category.parent?.emoji ?? category.emoji,
            name: category.parent?.name ?? category.name,
          },
          source: result.source,
          confidence: result.confidence,
        };
      }
    }

    return {
      category: await this.categoryHint(
        [label, caption].filter(Boolean).join(' '),
      ),
      source: 'RULE',
      confidence: 0.5,
    };
  }

  private async detectDuplicate(
    input: IngestInput,
    extraction: DocumentExtraction,
    categoryId: string,
  ): Promise<DuplicateHit | null> {
    return this.transactions.findPossibleDuplicate({
      familyId: input.familyId,
      userId: input.userId,
      type: extraction.movementType,
      amount: extraction.amount as number,
      at: extraction.date ?? new Date(),
      description: extraction.destination ?? extraction.supplier ?? 'Pagamento',
      merchant: extraction.destination ?? extraction.supplier,
      rawText: `comprovante ${extraction.paymentType ?? ''} ${extraction.destination ?? extraction.supplier ?? ''}`.trim(),
      categoryId,
    });
  }

  private async categoryHint(text: string): Promise<CategoryHint> {
    const slug = text === 'outros' ? 'outros' : matchCategoryKeyword(text) ?? 'outros';
    const category = await this.categories.findBySlug(slug);
    if (category) {
      return {
        id: category.id,
        emoji: category.parent?.emoji ?? category.emoji,
        name: category.parent?.name ?? category.name,
      };
    }

    const fallback = await this.categories.findBySlug('outros');
    return {
      id: fallback?.id ?? '',
      emoji: fallback?.emoji ?? '📦',
      name: fallback?.name ?? 'Outros',
    };
  }

  private async finish<T extends IngestResult>(
    id: string,
    data: {
      type?: DocumentType;
      extractedText?: string;
      parsedData?: Prisma.InputJsonValue;
      status?: DocumentStatus;
    },
    result: T,
  ): Promise<T> {
    const document = await this.prisma.document.update({
      where: { id },
      data,
    });
    return { ...result, document };
  }
}
