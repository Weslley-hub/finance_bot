import {
  incomeKindFromSlug,
  matchIncomeSlug,
} from './income';

describe('matchIncomeSlug', () => {
  it('classifica salário', () => {
    expect(matchIncomeSlug('recebi meu salário 5500')).toBe('salario');
    expect(incomeKindFromSlug('salario')).toBe('SALARY');
  });

  it('classifica freelance como renda extra', () => {
    expect(matchIncomeSlug('entrou 1200 de freelance')).toBe('renda-extra');
    expect(incomeKindFromSlug('renda-extra')).toBe('EXTRA_INCOME');
  });

  it('classifica reembolso', () => {
    expect(matchIncomeSlug('recebi 80 de reembolso')).toBe('reembolso');
    expect(incomeKindFromSlug('reembolso')).toBe('REFUND');
  });

  it('classifica rendimento', () => {
    expect(matchIncomeSlug('entrou 200 de rendimento')).toBe('rendimento');
    expect(incomeKindFromSlug('rendimento')).toBe('INVESTMENT_RETURN');
  });

  it('usa outras receitas quando não há pista', () => {
    expect(matchIncomeSlug('minha esposa recebeu 3500')).toBe('outras-receitas');
    expect(incomeKindFromSlug('outras-receitas')).toBe('OTHER');
  });
});
