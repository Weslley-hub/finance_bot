import { normalizeText } from './text-normalize';
import { BANKS } from '../documents/payment-classification';
import { queryDateRange } from './finance-query';

export type SearchWhen =
  | { kind: 'range'; months: number }
  | { kind: 'weekday'; day: number }
  | { kind: 'today' }
  | { kind: 'yesterday' };

export type ParsedSearch = {
  kind: 'search';
  needle?: string;
  cardHint?: string;
  minAmount?: number;
  when: SearchWhen;
};

const SEARCH_HINT =
  /\b(mostra|mostre|procura(?:r)?|busca(?:r)?|liste?)\b|\bo que gastamos\b|\bcompras?\s+d[aeo]\b|\bgastos?\s+(maiores?|acima)\b/i;

const WEEKDAYS: Array<{ pattern: RegExp; day: number }> = [
  { pattern: /\bdomingo\b/i, day: 0 },
  { pattern: /\bsegunda\b/i, day: 1 },
  { pattern: /\bter[cç]a\b/i, day: 2 },
  { pattern: /\bquarta\b/i, day: 3 },
  { pattern: /\bquinta\b/i, day: 4 },
  { pattern: /\bsexta\b/i, day: 5 },
  { pattern: /\bs[aá]bado\b/i, day: 6 },
];

const MIN_AMOUNT =
  /\b(?:maiores?|maior|acima)\s+(?:que|de)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{1,2})?)/i;

const NEEDLE_PATTERNS = [
  /\bprocura(?:r)?(?:\s+a)?(?:\s+compra)?(?:\s+d[aeo])?\s+(.+?)$/i,
  /\bcompras?\s+(?:do|da|de|no|na)\s+(.+?)$/i,
  /\bcompra\s+d[aeo]\s+(.+?)$/i,
];

export function parseSearch(text: string): ParsedSearch | null {
  const trimmed = text.trim().replace(/\?+$/, '');
  if (!trimmed || /\bquanto\b/i.test(trimmed)) {
    return null;
  }

  if (!SEARCH_HINT.test(trimmed)) {
    return null;
  }

  const minRaw = trimmed.match(MIN_AMOUNT)?.[1];
  const minAmount = minRaw ? parseMinAmount(minRaw) : undefined;
  const weekday = WEEKDAYS.find((item) => item.pattern.test(trimmed))?.day;
  const cardHint = extractCardHint(trimmed);
  let needle = extractNeedle(trimmed);

  if (cardHint && needle && normalizeText(needle) === normalizeText(cardHint)) {
    needle = undefined;
  }

  if (minAmount && needle && MIN_AMOUNT.test(needle)) {
    needle = undefined;
  }

  if (
    minAmount == null &&
    weekday == null &&
    !cardHint &&
    !needle &&
    !/\bhoje\b/i.test(trimmed) &&
    !/\bontem\b/i.test(trimmed)
  ) {
    return null;
  }

  const when: SearchWhen =
    weekday != null
      ? { kind: 'weekday', day: weekday }
      : /\bhoje\b/i.test(trimmed)
        ? { kind: 'today' }
        : /\bontem\b/i.test(trimmed)
          ? { kind: 'yesterday' }
          : { kind: 'range', months: 3 };

  return {
    kind: 'search',
    needle,
    cardHint,
    minAmount,
    when,
  };
}

export function searchDateRange(
  when: SearchWhen,
  at = new Date(),
): { from: Date; to: Date } {
  if (when.kind === 'today') {
    const from = startOfDay(at);
    return { from, to: addDays(from, 1) };
  }

  if (when.kind === 'yesterday') {
    const from = addDays(startOfDay(at), -1);
    return { from, to: startOfDay(at) };
  }

  if (when.kind === 'weekday') {
    const from = mostRecentWeekday(when.day, at);
    return { from, to: addDays(from, 1) };
  }

  return queryDateRange(when.months, at);
}

function extractCardHint(text: string): string | undefined {
  const haystack = normalizeText(text);
  const ranked = [...BANKS].sort((a, b) => b.key.length - a.key.length);
  for (const bank of ranked) {
    const escaped = bank.key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
    if (regex.test(haystack)) {
      return bank.label;
    }
  }

  return undefined;
}

function extractNeedle(text: string): string | undefined {
  for (const pattern of NEEDLE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const cleaned = match[1]
      .replace(/\b(todas?|os|as|o|a)\b/gi, ' ')
      .replace(/[?!.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length >= 3 && !MIN_AMOUNT.test(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
}

function parseMinAmount(raw: string): number | undefined {
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  return Math.round(amount * 100) / 100;
}

function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

function addDays(at: Date, days: number): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + days);
}

function mostRecentWeekday(day: number, at: Date): Date {
  const current = startOfDay(at);
  const diff = (current.getDay() - day + 7) % 7;
  return addDays(current, -diff);
}
