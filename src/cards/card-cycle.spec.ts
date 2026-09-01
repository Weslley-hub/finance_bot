import { invoiceCycleFor } from './card-cycle';

describe('invoiceCycleFor', () => {
  it('antes do fechamento entra na fatura do mês', () => {
    const cycle = invoiceCycleFor(22, 29, new Date(2026, 7, 10));
    expect(cycle.referenceMonth).toBe(8);
    expect(cycle.referenceYear).toBe(2026);
    expect(cycle.closingDate).toEqual(new Date(2026, 7, 22));
    expect(cycle.dueDate).toEqual(new Date(2026, 7, 29));
  });

  it('no dia do fechamento ainda entra nessa fatura', () => {
    const cycle = invoiceCycleFor(22, 29, new Date(2026, 7, 22));
    expect(cycle.referenceMonth).toBe(8);
    expect(cycle.dueDate).toEqual(new Date(2026, 7, 29));
  });

  it('depois do fechamento vai para a próxima fatura', () => {
    const cycle = invoiceCycleFor(22, 29, new Date(2026, 7, 31));
    expect(cycle.referenceMonth).toBe(9);
    expect(cycle.referenceYear).toBe(2026);
    expect(cycle.closingDate).toEqual(new Date(2026, 8, 22));
    expect(cycle.dueDate).toEqual(new Date(2026, 8, 29));
  });

  it('vence no mês seguinte quando o dia é menor que o fechamento', () => {
    const cycle = invoiceCycleFor(22, 5, new Date(2026, 7, 10));
    expect(cycle.closingDate).toEqual(new Date(2026, 7, 22));
    expect(cycle.dueDate).toEqual(new Date(2026, 8, 5));
  });
});
