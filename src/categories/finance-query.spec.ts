import {
  normalizeFinanceQuery,
  parseFinanceQuery,
  queryDateRange,
  previousMonthRange,
} from './finance-query';

describe('parseFinanceQuery', () => {
  it('quanto gastamos com mercado?', () => {
    expect(parseFinanceQuery('quanto gastamos com mercado?')).toEqual({
      kind: 'query',
      intent: 'by_category',
      person: 'family',
      categorySlug: 'mercado',
      months: 1,
    });
  });

  it('quanto gastamos com delivery?', () => {
    expect(parseFinanceQuery('quanto gastamos com delivery?')).toEqual({
      kind: 'query',
      intent: 'by_category',
      person: 'family',
      categorySlug: 'delivery',
      months: 1,
    });
  });

  it('quanto minha esposa gastou este mês?', () => {
    expect(parseFinanceQuery('quanto minha esposa gastou este mês?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'spouse',
      months: 1,
    });
  });

  it('quanto eu gastei?', () => {
    expect(parseFinanceQuery('quanto eu gastei?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'me',
      months: 1,
    });
  });

  it('quanto nós gastamos?', () => {
    expect(parseFinanceQuery('quanto nós gastamos?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'family',
      months: 1,
    });
  });

  it('quanto a Ana gastou?', () => {
    expect(parseFinanceQuery('quanto a Ana gastou?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'named',
      memberHint: 'Ana',
      months: 1,
    });
  });

  it('onde estamos gastando mais?', () => {
    expect(parseFinanceQuery('onde estamos gastando mais?')).toEqual({
      kind: 'query',
      intent: 'top_categories',
      person: 'family',
      months: 1,
    });
  });

  it('gastamos mais do que mês passado?', () => {
    expect(parseFinanceQuery('gastamos mais do que mês passado?')).toEqual({
      kind: 'query',
      intent: 'compare',
      person: 'family',
      months: 1,
    });
  });

  it('quais nossas maiores despesas?', () => {
    expect(parseFinanceQuery('quais nossas maiores despesas?')).toEqual({
      kind: 'query',
      intent: 'top_expenses',
      person: 'family',
      months: 1,
    });
  });

  it('quanto gastamos com combustível nos últimos três meses?', () => {
    expect(
      parseFinanceQuery(
        'quanto gastamos com combustível nos últimos três meses?',
      ),
    ).toEqual({
      kind: 'query',
      intent: 'by_category',
      person: 'family',
      categorySlug: 'combustivel',
      months: 3,
    });
  });

  it('não trata lançamento como pergunta', () => {
    expect(parseFinanceQuery('gastei 45 no almoço')).toBeNull();
    expect(parseFinanceQuery('mercado 350')).toBeNull();
  });
});

describe('normalizeFinanceQuery', () => {
  it('normaliza JSON da IA', () => {
    expect(
      normalizeFinanceQuery({
        intent: 'by_category',
        person: 'family',
        categorySlug: 'mercado',
        months: 3,
      }),
    ).toEqual({
      kind: 'query',
      intent: 'by_category',
      person: 'family',
      categorySlug: 'mercado',
      months: 3,
    });
  });
});

describe('queryDateRange', () => {
  it('um mês começa no dia 1', () => {
    const { from, to } = queryDateRange(1, new Date(2026, 7, 31));
    expect(from).toEqual(new Date(2026, 7, 1));
    expect(to).toEqual(new Date(2026, 8, 1));
  });

  it('três meses incluem o atual e os dois anteriores', () => {
    const { from, to } = queryDateRange(3, new Date(2026, 7, 31));
    expect(from).toEqual(new Date(2026, 5, 1));
    expect(to).toEqual(new Date(2026, 8, 1));
  });
});

describe('previousMonthRange', () => {
  it('pega o mês anterior inteiro', () => {
    const { from, to } = previousMonthRange(new Date(2026, 7, 31));
    expect(from).toEqual(new Date(2026, 6, 1));
    expect(to).toEqual(new Date(2026, 7, 1));
  });
});
