import {
  dueDateOn,
  isDueOnOrAfterToday,
  nextDueOccurrence,
} from './recurring-schedule';

describe('dueDateOn', () => {
  it('ajusta dia 31 em fevereiro', () => {
    expect(dueDateOn(2026, 2, 31).getDate()).toBe(28);
  });
});

describe('isDueOnOrAfterToday', () => {
  it('não materializa o mês cujo dia já passou', () => {
    expect(
      isDueOnOrAfterToday(dueDateOn(2026, 8, 10), new Date(2026, 7, 31)),
    ).toBe(false);
  });

  it('materializa o vencimento de hoje ou futuro', () => {
    expect(
      isDueOnOrAfterToday(dueDateOn(2026, 8, 31), new Date(2026, 7, 31)),
    ).toBe(true);
    expect(
      isDueOnOrAfterToday(dueDateOn(2026, 9, 10), new Date(2026, 7, 31)),
    ).toBe(true);
  });
});

describe('nextDueOccurrence', () => {
  it('usa o próximo mês se o dia já passou', () => {
    const next = nextDueOccurrence(10, new Date(2026, 7, 31));
    expect(next).toMatchObject({ year: 2026, month: 9 });
    expect(next.dueDate.getDate()).toBe(10);
    expect(next.dueDate.getMonth()).toBe(8);
  });

  it('mantém o mês se o dia ainda não chegou', () => {
    const next = nextDueOccurrence(10, new Date(2026, 8, 5));
    expect(next).toMatchObject({ year: 2026, month: 9 });
    expect(next.dueDate.getDate()).toBe(10);
  });
});
