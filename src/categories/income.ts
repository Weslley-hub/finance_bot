import { CATEGORY_CATALOG, CategorySeed } from './category-catalog';
import { matchCategoryKeyword } from './match-category-keywords';

export type IncomeKind =
  | 'SALARY'
  | 'EXTRA_INCOME'
  | 'REFUND'
  | 'INVESTMENT_RETURN'
  | 'OTHER';

export const INCOME_KIND_SLUG: Record<IncomeKind, string> = {
  SALARY: 'salario',
  EXTRA_INCOME: 'renda-extra',
  REFUND: 'reembolso',
  INVESTMENT_RETURN: 'rendimento',
  OTHER: 'outras-receitas',
};

export const INCOME_SLUG_KIND: Record<string, IncomeKind> = {
  salario: 'SALARY',
  'renda-extra': 'EXTRA_INCOME',
  reembolso: 'REFUND',
  rendimento: 'INVESTMENT_RETURN',
  'outras-receitas': 'OTHER',
};

const INCOME_CATALOG: CategorySeed[] = CATEGORY_CATALOG.filter((item) =>
  Boolean(INCOME_SLUG_KIND[item.slug]),
);

export function matchIncomeSlug(text: string): string {
  return matchCategoryKeyword(text, INCOME_CATALOG) ?? INCOME_KIND_SLUG.OTHER;
}

export function incomeKindFromSlug(slug: string): IncomeKind {
  return INCOME_SLUG_KIND[slug] ?? 'OTHER';
}
