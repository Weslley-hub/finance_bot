export function splitCategoryIds(category: {
  id: string;
  parentId: string | null;
}): { categoryId: string; subcategoryId: string | null } {
  if (category.parentId) {
    return { categoryId: category.parentId, subcategoryId: category.id };
  }

  return { categoryId: category.id, subcategoryId: null };
}

export function effectiveCategoryId(tx: {
  categoryId: string;
  subcategoryId?: string | null;
}): string {
  return tx.subcategoryId ?? tx.categoryId;
}
