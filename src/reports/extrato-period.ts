import { normalizeText } from '../categories/text-normalize';
import { monthName } from '../documents/document-extraction';

export type ExtratoRange = {
  from: Date;
  to: Date;
  label: string;
};

const MONTH_PATTERN =
  /janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i;

export function parseExtratoRange(
  filter = '',
  at = new Date(),
): ExtratoRange | null {
  const trimmed = filter.trim();
  if (!trimmed || /^(m[eê]s|este\s+m[eê]s)$/i.test(trimmed)) {
    return monthRange(at.getMonth(), at.getFullYear());
  }

  if (/^hoje$/i.test(trimmed)) {
    const from = startOfDay(at);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    return { from, to, label: 'hoje' };
  }

  if (/^semana$/i.test(trimmed)) {
    const from = startOfWeek(at);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    return { from, to, label: 'semana' };
  }

  const monthMatch = trimmed.match(MONTH_PATTERN);
  if (!monthMatch) {
    return null;
  }

  const names = Array.from({ length: 12 }, (_, index) =>
    normalizeText(monthName(index)),
  );
  const monthIndex = names.indexOf(normalizeText(monthMatch[0]));
  if (monthIndex < 0) {
    return null;
  }

  const yearMatch = trimmed.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : at.getFullYear();
  if (!yearMatch && monthIndex > at.getMonth()) {
    year -= 1;
  }

  return monthRange(monthIndex, year);
}

function monthRange(monthIndex: number, year: number): ExtratoRange {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 1);
  const label = monthName(monthIndex);
  return { from, to, label };
}

function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

function startOfWeek(at: Date): Date {
  const day = at.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return startOfDay(new Date(at.getFullYear(), at.getMonth(), at.getDate() - diff));
}
