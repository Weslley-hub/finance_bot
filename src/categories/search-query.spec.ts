import { parseSearch, searchDateRange } from './search-query';

describe('parseSearch', () => {
  it('mostra todas as compras do Nubank', () => {
    expect(parseSearch('mostra todas as compras do Nubank')).toEqual({
      kind: 'search',
      cardHint: 'Nubank',
      when: { kind: 'range', months: 3 },
    });
  });

  it('mostra gastos maiores que 500', () => {
    expect(parseSearch('mostra gastos maiores que 500')).toEqual({
      kind: 'search',
      minAmount: 500,
      when: { kind: 'range', months: 3 },
    });
  });

  it('procura a compra da Amazon', () => {
    expect(parseSearch('procura a compra da Amazon')).toEqual({
      kind: 'search',
      needle: 'Amazon',
      when: { kind: 'range', months: 3 },
    });
  });

  it('o que gastamos sexta?', () => {
    expect(parseSearch('o que gastamos sexta?')).toEqual({
      kind: 'search',
      when: { kind: 'weekday', day: 5 },
    });
  });

  it('não trata quanto gastamos como busca', () => {
    expect(parseSearch('quanto gastamos com mercado?')).toBeNull();
  });
});

describe('searchDateRange', () => {
  it('pega a sexta mais recente', () => {
    const { from, to } = searchDateRange(
      { kind: 'weekday', day: 5 },
      new Date(2026, 7, 31),
    );
    expect(from).toEqual(new Date(2026, 7, 28));
    expect(to).toEqual(new Date(2026, 7, 29));
  });
});
