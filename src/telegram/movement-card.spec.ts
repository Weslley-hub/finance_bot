import { formatMonthYear, typeTitle } from './movement-card';

describe('formatMonthYear', () => {
  it('formata agosto de 2026', () => {
    expect(formatMonthYear(new Date(2026, 7, 31))).toBe('Agosto/2026');
  });
});

describe('typeTitle', () => {
  it('usa o cartão de receita', () => {
    expect(typeTitle('INCOME')).toBe('💵 Receita registrada');
  });
});
