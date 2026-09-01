import { effectiveCategoryId, splitCategoryIds } from './transaction-category';

describe('splitCategoryIds', () => {
  it('separa pai e subcategoria', () => {
    expect(
      splitCategoryIds({ id: 'mercado', parentId: 'alimentacao' }),
    ).toEqual({
      categoryId: 'alimentacao',
      subcategoryId: 'mercado',
    });
  });

  it('mantém categoria raiz sem subcategoria', () => {
    expect(splitCategoryIds({ id: 'outros', parentId: null })).toEqual({
      categoryId: 'outros',
      subcategoryId: null,
    });
  });
});

describe('effectiveCategoryId', () => {
  it('prefere a subcategoria quando existe', () => {
    expect(
      effectiveCategoryId({
        categoryId: 'alimentacao',
        subcategoryId: 'mercado',
      }),
    ).toBe('mercado');
  });
});
