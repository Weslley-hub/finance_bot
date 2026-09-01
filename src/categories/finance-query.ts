import { matchCategoryKeyword } from './match-category-keywords';

export type FinanceQueryPerson = 'me' | 'family' | 'spouse' | 'named';

export type FinanceQueryIntent =
  | 'total'
  | 'by_category'
  | 'top_categories'
  | 'top_expenses'
  | 'compare';

export type ParsedQuery = {
  kind: 'query';
  intent: FinanceQueryIntent;
  person: FinanceQueryPerson;
  memberHint?: string;
  categorySlug?: string;
  months: number;
};

const COMPARE =
  /\bmais(\s+do)?\s+que\s+(o\s+)?m[eê]s\s+passado\b/i;
const TOP_WHERE = /\bonde\b[\s\S]*\bgast/i;
const TOP_EXPENSES = /\bmaiores?\s+(despesas?|gastos?)\b/i;
const LAST_N_MONTHS =
  /[uú]ltimos?\s+(\d{1,2}|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+meses?/i;

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

export function parseFinanceQuery(text: string): ParsedQuery | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (COMPARE.test(trimmed) && /\bgast/i.test(trimmed)) {
    return {
      kind: 'query',
      intent: 'compare',
      person: 'family',
      months: 1,
    };
  }

  if (TOP_WHERE.test(trimmed)) {
    return {
      kind: 'query',
      intent: 'top_categories',
      person: 'family',
      months: parseMonths(trimmed),
    };
  }

  if (TOP_EXPENSES.test(trimmed)) {
    return {
      kind: 'query',
      intent: 'top_expenses',
      ...parseWho(trimmed),
      months: parseMonths(trimmed),
    };
  }

  if (!/\bquanto\b/i.test(trimmed) || !/\bgast/i.test(trimmed)) {
    return null;
  }

  const categorySlug = matchCategoryKeyword(trimmed);
  return {
    kind: 'query',
    intent: categorySlug ? 'by_category' : 'total',
    ...parseWho(trimmed),
    categorySlug,
    months: parseMonths(trimmed),
  };
}

export function looksLikeFinanceQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (parseFinanceQuery(trimmed)) {
    return true;
  }

  return (
    /^(quanto|onde|quais|qual)\b/i.test(trimmed) ||
    /\bgastamos\s+mais\b/i.test(trimmed) ||
    /\bpara\s+pagar\b/i.test(trimmed) ||
    /\b(mostra|procura|busca)\b/i.test(trimmed) ||
    /\bo que gastamos\b/i.test(trimmed) ||
    (/\?\s*$/.test(trimmed) && /\bgast/i.test(trimmed))
  );
}

export function queryDateRange(
  months: number,
  at = new Date(),
): { from: Date; to: Date } {
  const safeMonths = Math.min(24, Math.max(1, months));
  const to = new Date(at.getFullYear(), at.getMonth() + 1, 1);
  const from = new Date(at.getFullYear(), at.getMonth() - (safeMonths - 1), 1);
  return { from, to };
}

export function previousMonthRange(at = new Date()): { from: Date; to: Date } {
  const to = new Date(at.getFullYear(), at.getMonth(), 1);
  const from = new Date(at.getFullYear(), at.getMonth() - 1, 1);
  return { from, to };
}

function parseWho(text: string): {
  person: FinanceQueryPerson;
  memberHint?: string;
} {
  if (/\b(esposa|esposo|mulher|marido|namorada|namorado)\b/i.test(text)) {
    return { person: 'spouse' };
  }

  const memberHint = parseNamedMember(text);
  if (memberHint) {
    return { person: 'named', memberHint };
  }

  if (/\beu\b/i.test(text) || /\bgastei\b/i.test(text)) {
    return { person: 'me' };
  }

  return { person: 'family' };
}

const NAMED_MEMBER =
  /\b(?:o|a)\s+([A-Za-zÀ-ÿ]{2,})(?:\s+(?!gast)[A-Za-zÀ-ÿ]+)?\s+gast/i;

const SKIP_MEMBER_HINTS = new Set([
  'FAMILIA',
  'GENTE',
  'CASA',
  'MES',
  'GRUPO',
]);

function parseNamedMember(text: string): string | undefined {
  const match = text.match(NAMED_MEMBER);
  if (!match) {
    return undefined;
  }

  const hint = match[1].trim();
  const normalized = hint
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (SKIP_MEMBER_HINTS.has(normalized) || matchCategoryKeyword(hint)) {
    return undefined;
  }

  return hint;
}

const INTENTS: FinanceQueryIntent[] = [
  'total',
  'by_category',
  'top_categories',
  'top_expenses',
  'compare',
];

const PERSONS: FinanceQueryPerson[] = ['me', 'family', 'spouse', 'named'];

export function normalizeFinanceQuery(raw: unknown): ParsedQuery | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const intent = INTENTS.find((item) => item === data.intent);
  if (!intent) {
    return null;
  }

  const person = PERSONS.find((item) => item === data.person) ?? 'family';
  const monthsRaw = Number(data.months ?? 1);
  const months = Number.isFinite(monthsRaw)
    ? Math.min(24, Math.max(1, Math.round(monthsRaw)))
    : 1;

  const categorySlug =
    typeof data.categorySlug === 'string' && data.categorySlug.trim()
      ? data.categorySlug.trim()
      : undefined;

  const memberHint =
    typeof data.memberHint === 'string' && data.memberHint.trim()
      ? data.memberHint.trim()
      : undefined;

  return {
    kind: 'query',
    intent: intent === 'by_category' && !categorySlug ? 'total' : intent,
    person,
    memberHint: person === 'named' ? memberHint : undefined,
    categorySlug,
    months,
  };
}

function parseMonths(text: string): number {
  const match = text.match(LAST_N_MONTHS);
  if (!match) {
    return 1;
  }

  const raw = match[1]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/^\d+$/.test(raw)) {
    return Math.min(24, Math.max(1, Number(raw)));
  }

  return NUMBER_WORDS[raw] ?? 1;
}
