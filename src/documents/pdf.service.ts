import { Injectable, Logger } from '@nestjs/common';

type PdfParseResult = { text?: string };

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async extractText(buffer: Buffer): Promise<string> {
    try {
      // Import the implementation file to skip pdf-parse's debug bootstrap.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
        data: Buffer,
      ) => Promise<PdfParseResult>;
      const result = await pdfParse(buffer);
      return (result.text ?? '').trim();
    } catch (error) {
      this.logger.warn(
        `Falha ao extrair texto do PDF: ${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }
}

export function hasUsablePdfText(text: string): boolean {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length >= 40 && /\d/.test(compact);
}
