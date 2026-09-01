import { splitInstallments, shiftMonth } from './installment-split';

describe('splitInstallments', () => {
  it('divide 2400 em 10x de 240', () => {
    expect(splitInstallments(2400, 10)).toEqual(Array(10).fill(240));
  });

  it('distribui o resto nos primeiros centavos', () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });
});

describe('shiftMonth', () => {
  it('avança para o mês seguinte', () => {
    expect(shiftMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
  });
});
