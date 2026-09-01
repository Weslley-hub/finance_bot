import { Injectable } from '@nestjs/common';
import { CategorizationSource } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import {
  DocumentExtraction,
  ExtractionValidation,
  classifyDocumentType,
  mergeExtractions,
  normalizeExtraction,
  parseReceiptText,
  validateExtraction,
} from './document-extraction';
import {
  CardInvoiceLine,
  looksLikeCardInvoice,
  parseCardInvoiceItems,
} from './card-invoice';
import { inferMovementType } from './payment-classification';
import { hasUsablePdfText, PdfService } from './pdf.service';

export type PipelineInput = {
  buffer: Buffer;
  mimeType: string;
  caption?: string;
  isPdf: boolean;
  fileName?: string;
};

export type PipelineResult = {
  extraction: DocumentExtraction | null;
  validation: ExtractionValidation | null;
  source: CategorizationSource;
  extractedText: string;
  scannedPdf: boolean;
  invoiceItems: CardInvoiceLine[];
  looksLikeInvoice: boolean;
};

@Injectable()
export class DocumentPipelineService {
  constructor(
    private readonly pdf: PdfService,
    private readonly ai: AiService,
  ) {}

  async process(input: PipelineInput): Promise<PipelineResult> {
    const extracted = await this.extract(input);
    const classified = this.classify(extracted, input);
    return this.normalize(classified, input);
  }

  async extract(input: PipelineInput): Promise<PipelineResult> {
    let extractedText = '';
    let heuristic: DocumentExtraction | null = null;
    let scannedPdf = false;

    if (input.isPdf) {
      extractedText = await this.pdf.extractText(input.buffer);
      if (hasUsablePdfText(extractedText)) {
        heuristic = parseReceiptText(
          [extractedText, input.caption].filter(Boolean).join('\n'),
        );
      } else {
        scannedPdf = true;
      }
    } else if (input.caption) {
      heuristic = parseReceiptText(input.caption);
      extractedText = input.caption;
    }

    const invoiceItems =
      input.isPdf && hasUsablePdfText(extractedText)
        ? parseCardInvoiceItems(extractedText)
        : [];
    const looksLikeInvoice = looksLikeCardInvoice(
      extractedText,
      input.fileName,
      invoiceItems.length,
    );

    let aiResult: DocumentExtraction | null = null;
    if (this.ai.isEnabled() && !looksLikeInvoice && !scannedPdf) {
      if (input.isPdf && hasUsablePdfText(extractedText)) {
        aiResult = await this.ai.analyzeDocumentText(extractedText, input.caption);
      } else if (!input.isPdf) {
        aiResult = await this.ai.analyzeDocumentImage(
          input.buffer.toString('base64'),
          input.mimeType,
          input.caption,
        );
      }
    }

    const merged = mergeExtractions(heuristic, aiResult);

    return {
      extraction: merged,
      validation: merged ? validateExtraction(merged) : null,
      source: aiResult ? 'AI' : 'MANUAL',
      extractedText,
      scannedPdf,
      invoiceItems,
      looksLikeInvoice,
    };
  }

  classify(result: PipelineResult, input: PipelineInput): PipelineResult {
    if (!result.extraction) {
      return result;
    }

    const kind = result.looksLikeInvoice
      ? 'INVOICE'
      : classifyDocumentType({
          text: [result.extractedText, input.caption].filter(Boolean).join(' '),
          fileName: input.fileName,
          kind: result.extraction.kind,
          paymentType: result.extraction.paymentType,
          looksLikeInvoice: result.looksLikeInvoice,
        });

    const extraction = { ...result.extraction, kind };
    return {
      ...result,
      extraction,
      validation: result.validation
        ? { ...result.validation, extraction }
        : validateExtraction(extraction),
    };
  }

  normalize(result: PipelineResult, input: PipelineInput): PipelineResult {
    if (!result.extraction) {
      return result;
    }

    const extraction = normalizeExtraction(result.extraction, {
      text: [result.extractedText, input.caption].filter(Boolean).join(' '),
      fileName: input.fileName,
    });

    if (result.looksLikeInvoice) {
      extraction.kind = 'INVOICE';
    }

    if (result.source !== 'AI' || extraction.movementType !== 'INCOME') {
      extraction.movementType = inferMovementType({
        text: [result.extractedText, input.caption].filter(Boolean).join(' '),
        paymentType: extraction.paymentType,
        originBank: extraction.originBank,
        destinationBank: extraction.destinationBank,
        destination: extraction.destination,
        supplier: extraction.supplier,
        bank: extraction.bank,
      });
    }

    return {
      ...result,
      extraction,
      validation: validateExtraction(extraction),
    };
  }
}
