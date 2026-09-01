import { CATEGORY_CATALOG, CategorySeed } from './category-catalog';
import { normalizeText } from './text-normalize';

export type CategoryKeyword = {
  slug: string;
  keyword: string;
  depth: number;
};

export function buildCategoryKeywords(
  catalog: CategorySeed[] = CATEGORY_CATALOG,
): CategoryKeyword[] {
  const keywords: CategoryKeyword[] = [];

  const walk = (item: CategorySeed, depth: number) => {
    const values = [item.name, item.slug.replace(/-/g, ' '), ...(item.aliases ?? [])];

    for (const value of values) {
      const keyword = normalizeText(value);
      if (keyword.length < 3 || keyword === 'OUTROS') {
        continue;
      }

      keywords.push({ slug: item.slug, keyword, depth });
    }

    for (const child of item.children ?? []) {
      walk(child, depth + 1);
    }
  };

  for (const item of catalog) {
    walk(item, 0);
  }

  return keywords;
}

export function matchCategoryKeyword(
  text: string,
  catalog: CategorySeed[] = CATEGORY_CATALOG,
): string | undefined {
  const haystack = normalizeText(text);
  const keywords = buildCategoryKeywords(catalog);

  let best: CategoryKeyword | undefined;

  for (const candidate of keywords) {
    const escaped = candidate.keyword.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
    if (!regex.test(haystack)) {
      continue;
    }

    if (
      !best ||
      candidate.keyword.length > best.keyword.length ||
      (candidate.keyword.length === best.keyword.length &&
        candidate.depth > best.depth)
    ) {
      best = candidate;
    }
  }

  return best?.slug;
}
