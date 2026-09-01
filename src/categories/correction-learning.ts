import { CategorizationSource } from '@prisma/client';
import { normalizeText, stripNoiseWords } from './text-normalize';

const GENERIC_TOKENS = new Set([
  'PAGAMENTO',
  'COMPROVANTE',
  'OUTROS',
  'DESTINO',
  'FATURA',
  'VALOR',
  'PIX',
  'TED',
  'BOLETO',
  'CARTAO',
  'TRANSFERENCIA',
  'RECEIPT',
  'COMPRA',
  'COMPRAS',
  'LANCAMENTO',
  'PARCELA',
]);

export type LearnedHistoryRow = {
  merchant: string | null;
  description: string;
  rawText: string | null;
  categorizationSource: CategorizationSource;
  categorySlug: string;
};

export function learningTokens(text: string): string[] {
  return stripNoiseWords(text)
    .split(' ')
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !GENERIC_TOKENS.has(token) &&
        !/^\d+$/.test(token),
    );
}

export function merchantToPattern(merchant: string): string | null {
  const token = learningTokens(merchant)[0];
  if (!token) {
    return null;
  }

  return `${token}*`;
}

export function learningMerchant(input: {
  merchant?: string | null;
  rawText?: string | null;
  description?: string | null;
}): string | undefined {
  const fromMerchant = learningTokens(input.merchant ?? '')[0];
  if (fromMerchant) {
    return input.merchant?.trim() || fromMerchant;
  }

  const fromRaw = learningTokens(input.rawText ?? '')[0];
  if (fromRaw) {
    return fromRaw;
  }

  const fromDescription = learningTokens(input.description ?? '')[0];
  return fromDescription;
}

export function historyMerchantMatches(
  haystack: string,
  row: LearnedHistoryRow,
): boolean {
  const token =
    learningTokens(row.merchant ?? '')[0] ??
    learningTokens(row.rawText ?? '')[0];
  if (!token) {
    return false;
  }

  const hay = normalizeText(haystack);
  const escaped = token.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(hay);
}

export function pickLearnedHistory<T extends LearnedHistoryRow>(
  haystack: string,
  rows: T[],
): T | undefined {
  const learned = rows.filter(
    (row) =>
      (row.categorizationSource === 'MANUAL' ||
        row.categorizationSource === 'HISTORY') &&
      historyMerchantMatches(haystack, row),
  );

  return learned[0];
}
