import { buildMetaCard, goalPercent, toGoalProgress } from './meta-card';

describe('goalPercent', () => {
  it('calcula 71% no exemplo do épico', () => {
    expect(goalPercent(1420, 2000)).toBe(71);
  });

  it('é zero sem meta', () => {
    expect(goalPercent(100, 0)).toBe(0);
  });
});

describe('toGoalProgress', () => {
  it('não deixa saldo negativo', () => {
    expect(toGoalProgress(-50, 2000)).toMatchObject({
      saved: 0,
      percent: 0,
    });
  });
});

describe('buildMetaCard', () => {
  it('monta o cartão da meta', () => {
    const card = buildMetaCard({ saved: 1420, target: 2000, percent: 71 });
    expect(card).toContain('🎯 Meta mensal');
    expect(card).toContain('71%');
  });
});
