import { normalizeText } from './text-normalize';

export type MatchableRule = {
  pattern: string;
  familyId: string | null;
  confidence: number;
};

export function patternToRegex(pattern: string): RegExp {
  const normalized = normalizeText(pattern);
  const escaped = normalized
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(escaped);
}

export function matchRule<T extends MatchableRule>(
  text: string,
  rules: T[],
  familyId?: string,
): T | undefined {
  const haystack = normalizeText(text);

  const ranked = [...rules].sort((a, b) => {
    const familyBoost =
      Number(b.familyId === familyId) - Number(a.familyId === familyId);
    if (familyBoost !== 0) {
      return familyBoost;
    }

    return b.pattern.length - a.pattern.length;
  });

  return ranked.find((rule) => patternToRegex(rule.pattern).test(haystack));
}
