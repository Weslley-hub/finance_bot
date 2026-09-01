import { TransactionType } from '@prisma/client';
import { parseAmount } from '../categories/message-parser';
import { normalizeText } from '../categories/text-normalize';
import {
  findBanksInOrder,
  inferMovementType,
  normalizePaymentType,
  PaymentType,
} from './payment-classification';

export type DocumentVisionKind =
  | 'RECEIPT'
  | 'BANK_RECEIPT'
  | 'BILL'
  | 'INVOICE'
  | 'BANK_STATEMENT'
  | 'UNKNOWN';

const DOCUMENT_TYPES: DocumentVisionKind[] = [
  'RECEIPT',
  'BANK_RECEIPT',
  'BILL',
  'INVOICE',
  'BANK_STATEMENT',
  'UNKNOWN',
];

export type DocumentExtraction = {
  kind: DocumentVisionKind;
  amount: number | null;
  date: Date | null;
  dueDate: Date | null;
  paymentType: PaymentType | null;
  movementType: TransactionType;
  originBank: string | null;
  destinationBank: string | null;
  destination: string | null;
  supplier: string | null;
  bank: string | null;
  barcode: string | null;
  description: string | null;
};

export type ExtractionValidation = {
  valid: boolean;
  errors: string[];
  extraction: DocumentExtraction;
};

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function monthName(monthIndex: number): string {
  return MONTHS[monthIndex] ?? '';
}

export function parseBrazilianDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!br) {
    return null;
  }

  const day = Number(br[1]);
  const month = Number(br[2]) - 1;
  let year = Number(br[3]);
  if (year < 100) {
    year += 2000;
  }

  return new Date(year, month, day);
}

export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function formatFullDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

export function parseDocumentExtraction(raw: unknown): DocumentExtraction | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const amountSource = data.amount ?? data.valor ?? data.value ?? null;
  const amount =
    typeof amountSource === 'number'
      ? amountSource
      : parseAmount(String(amountSource ?? ''));

  const destination = stringField(data, ['destination', 'destino', 'payee']);
  const supplier = stringField(data, ['supplier', 'fornecedor', 'issuer']);
  const bank = stringField(data, ['bank', 'banco']);
  const originBank =
    stringField(data, ['originBank', 'bancoOrigem', 'fromBank']) ?? bank;
  const destinationBank = stringField(data, [
    'destinationBank',
    'bancoDestino',
    'toBank',
  ]);
  const paymentType = normalizePaymentType(
    stringField(data, ['paymentType', 'type', 'tipo']),
  );
  const kind = classifyDocumentType({
    kind: String(data.kind ?? 'UNKNOWN'),
    paymentType,
    text: [
      destination,
      supplier,
      bank,
      originBank,
      destinationBank,
      stringField(data, ['description', 'descricao']),
    ]
      .filter(Boolean)
      .join(' '),
  });
  const movementRaw = stringField(data, ['movementType', 'tipoMovimento']);
  const inferred = inferMovementType({
    paymentType,
    originBank,
    destinationBank,
    destination,
    supplier,
    bank,
  });
  const movementType =
    movementRaw === 'INCOME'
      ? 'INCOME'
      : inferred === 'TRANSFER' || movementRaw === 'TRANSFER'
        ? 'TRANSFER'
        : inferred;

  return {
    kind,
    amount: amount && amount > 0 ? amount : null,
    date: parseBrazilianDate(stringField(data, ['date', 'data', 'paidAt'])),
    dueDate: parseBrazilianDate(
      stringField(data, ['dueDate', 'vencimento', 'due_date']),
    ),
    paymentType,
    movementType,
    originBank,
    destinationBank,
    destination,
    supplier,
    bank: bank ?? originBank,
    barcode: stringField(data, ['barcode', 'codigoBarras', 'linhaDigitavel']),
    description: stringField(data, ['description', 'descricao']),
  };
}

export function parseReceiptText(text: string): DocumentExtraction | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const amountMatch = text.match(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))/i,
  );
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
  const paymentType = normalizePaymentType(text);
  const banks = findBanksInOrder(text);
  const looksLikeBill = /\b(VENCIMENTO|CODIGO DE BARRAS|LINHA DIGITAVEL|CONTA DE)\b/.test(
    normalized,
  );
  const looksLikeInvoice =
    /\bFATURA\b/.test(normalized) &&
    /\b(NUBANK|ITAU|INTER|C6|BRADESCO|SANTANDER|CARTAO|MASTERCARD|VISA)\b/.test(
      normalized,
    );
  const kind = classifyDocumentType({
    text,
    paymentType,
    looksLikeInvoice,
    looksLikeBill,
  });

  const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
  const dueMatch = text.match(
    /venc(?:imento)?[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  );

  const originBank = banks[0] ?? null;
  const destinationBank = banks[1] ?? null;
  const destinationFromLine =
    text.match(/(?:para|destino|favorecido)[:\s]+([^\n]+)/i)?.[1]?.trim() ??
    null;
  const destination = destinationFromLine ?? destinationBank;

  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 80);

  const extraction: DocumentExtraction = {
    kind,
    amount,
    date: parseBrazilianDate(dateMatch?.[1]),
    dueDate: parseBrazilianDate(dueMatch?.[1]),
    paymentType:
      paymentType ?? (originBank && destinationBank ? 'TRANSFER' : null),
    movementType: inferMovementType({
      text,
      paymentType,
      originBank,
      destinationBank,
      destination,
      bank: originBank,
    }),
    originBank,
    destinationBank,
    destination,
    supplier:
      kind === 'BILL' || kind === 'INVOICE'
        ? (destinationFromLine ?? destination ?? snippet)
        : null,
    bank: originBank,
    barcode: text.match(/\d{44,48}/)?.[0] ?? null,
    description:
      kind === 'BILL' || kind === 'INVOICE' || kind === 'BANK_STATEMENT'
        ? snippet
        : 'Comprovante',
  };

  return extraction;
}

export function validateExtraction(
  extraction: DocumentExtraction,
): ExtractionValidation {
  const errors: string[] = [];
  const next = { ...extraction };

  if (next.kind === 'UNKNOWN' && next.amount) {
    next.kind = classifyDocumentType({
      kind: 'RECEIPT',
      paymentType: next.paymentType,
      text: [next.originBank, next.destinationBank, next.destination, next.supplier]
        .filter(Boolean)
        .join(' '),
    });
  }

  if (next.kind === 'UNKNOWN') {
    errors.push('Não identifiquei se é comprovante, fatura, conta ou extrato.');
  }

  if (!next.amount) {
    errors.push('Não encontrei o valor.');
  }

  next.movementType = inferMovementType({
    text: [next.originBank, next.destinationBank, next.destination, next.supplier]
      .filter(Boolean)
      .join(' '),
    paymentType: next.paymentType,
    originBank: next.originBank,
    destinationBank: next.destinationBank,
    destination: next.destination,
    supplier: next.supplier,
    bank: next.bank,
  });

  if (extraction.movementType === 'INCOME') {
    next.movementType = 'INCOME';
  }

  return {
    valid: errors.length === 0,
    errors,
    extraction: next,
  };
}

export function parseDocumentType(value?: string | null): DocumentVisionKind {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  return DOCUMENT_TYPES.includes(raw as DocumentVisionKind)
    ? (raw as DocumentVisionKind)
    : 'UNKNOWN';
}

export function classifyDocumentType(input: {
  text?: string | null;
  fileName?: string | null;
  kind?: string | null;
  paymentType?: PaymentType | null;
  looksLikeInvoice?: boolean;
  looksLikeBill?: boolean;
}): DocumentVisionKind {
  const haystack = normalizeText(
    [input.fileName, input.text].filter(Boolean).join(' '),
  );
  const hinted = parseDocumentType(input.kind);

  if (
    input.looksLikeInvoice ||
    hinted === 'INVOICE' ||
    (/\bFATURA\b/.test(haystack) &&
      /\b(NUBANK|ITAU|INTER|C6|BRADESCO|SANTANDER|CARTAO|MASTERCARD|VISA|INVOICE)\b/.test(
        haystack,
      ))
  ) {
    return 'INVOICE';
  }

  if (
    hinted === 'BANK_STATEMENT' ||
    (/\bEXTRATO\b/.test(haystack) &&
      /\b(BANCO|CONTA|SALDO|LANCAMENTOS?)\b/.test(haystack))
  ) {
    return 'BANK_STATEMENT';
  }

  if (
    input.looksLikeBill ||
    hinted === 'BILL' ||
    /\b(VENCIMENTO|CODIGO DE BARRAS|LINHA DIGITAVEL|CONTA DE)\b/.test(haystack)
  ) {
    return 'BILL';
  }

  if (
    hinted === 'BANK_RECEIPT' ||
    input.paymentType === 'PIX' ||
    input.paymentType === 'TED' ||
    input.paymentType === 'TRANSFER' ||
    (/\bCOMPROVANTE\b/.test(haystack) &&
      /\b(PIX|TED|TRANSFERENCIA)\b/.test(haystack))
  ) {
    return 'BANK_RECEIPT';
  }

  if (
    hinted === 'RECEIPT' ||
    input.paymentType === 'CARD' ||
    input.paymentType === 'PAYMENT' ||
    input.paymentType === 'BOLETO' ||
    /\bCOMPROVANTE\b/.test(haystack)
  ) {
    return 'RECEIPT';
  }

  return hinted;
}

export function mergeExtractions(
  heuristic: DocumentExtraction | null,
  ai: DocumentExtraction | null,
): DocumentExtraction | null {
  if (!ai && !heuristic) {
    return null;
  }

  if (!ai) {
    return heuristic;
  }

  if (!heuristic) {
    return ai;
  }

  return {
    kind:
      ai.kind !== 'UNKNOWN'
        ? classifyDocumentType({
            kind: ai.kind,
            paymentType: ai.paymentType ?? heuristic.paymentType,
          })
        : heuristic.kind,
    amount: ai.amount ?? heuristic.amount,
    date: ai.date ?? heuristic.date,
    dueDate: ai.dueDate ?? heuristic.dueDate,
    paymentType: ai.paymentType ?? heuristic.paymentType,
    movementType: ai.movementType,
    originBank: ai.originBank ?? heuristic.originBank,
    destinationBank: ai.destinationBank ?? heuristic.destinationBank,
    destination: ai.destination ?? heuristic.destination,
    supplier: ai.supplier ?? heuristic.supplier,
    bank: ai.bank ?? heuristic.bank,
    barcode: ai.barcode ?? heuristic.barcode,
    description: ai.description ?? heuristic.description,
  };
}

function stringField(
  data: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function normalizeExtraction(
  extraction: DocumentExtraction,
  extra?: { text?: string | null; fileName?: string | null },
): DocumentExtraction {
  const destination = cleanLabel(extraction.destination);
  const supplier = cleanLabel(extraction.supplier);
  const originBank = cleanLabel(extraction.originBank);
  const destinationBank = cleanLabel(extraction.destinationBank);
  const paymentType = extraction.paymentType;
  const movementType = inferMovementType({
    text: extra?.text,
    paymentType,
    originBank,
    destinationBank,
    destination,
    supplier,
    bank: originBank,
  });

  return {
    ...extraction,
    amount:
      extraction.amount != null && extraction.amount > 0
        ? Math.round(extraction.amount * 100) / 100
        : null,
    destination,
    supplier,
    originBank,
    destinationBank,
    bank: cleanLabel(extraction.bank) ?? originBank,
    barcode: cleanLabel(extraction.barcode),
    description: cleanLabel(extraction.description),
    movementType:
      extraction.movementType === 'INCOME' ? 'INCOME' : movementType,
    kind: classifyDocumentType({
      text: extra?.text,
      fileName: extra?.fileName,
      kind: extraction.kind,
      paymentType,
    }),
  };
}

export function extractionToJson(extracted: DocumentExtraction) {
  return {
    kind: extracted.kind,
    amount: extracted.amount,
    date: extracted.date?.toISOString() ?? null,
    dueDate: extracted.dueDate?.toISOString() ?? null,
    paymentType: extracted.paymentType,
    movementType: extracted.movementType,
    originBank: extracted.originBank,
    destinationBank: extracted.destinationBank,
    destination: extracted.destination,
    supplier: extracted.supplier,
    bank: extracted.bank,
    barcode: extracted.barcode,
    description: extracted.description,
  };
}

function cleanLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}
