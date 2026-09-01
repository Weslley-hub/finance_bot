import { matchCategoryKeyword } from './match-category-keywords';

describe('matchCategoryKeyword', () => {
  it('classifica gasolina como combustível', () => {
    expect(matchCategoryKeyword('Gasto 279,40 Gasolina Carro')).toBe(
      'combustivel',
    );
  });

  it('classifica almoço como subcategoria', () => {
    expect(matchCategoryKeyword('gastei 45 no almoço')).toBe('almoco');
  });

  it('classifica ENEL como energia', () => {
    expect(matchCategoryKeyword('ENEL')).toBe('energia');
  });

  it('classifica curso como educação', () => {
    expect(matchCategoryKeyword('amazon curso')).toBe('educacao');
  });
});
