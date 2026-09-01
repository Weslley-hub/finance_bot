import {
  isAmbiguousTransfer,
  parseAmount,
  parseMessage,
  parseRecurringBillFromCommand,
} from './message-parser';

describe('parseAmount', () => {
  it('aceita inteiro', () => {
    expect(parseAmount('76')).toBe(76);
  });

  it('aceita decimal brasileiro', () => {
    expect(parseAmount('45,90')).toBe(45.9);
  });

  it('aceita milhar brasileiro', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });
});

describe('parseMessage', () => {
  it('detecta gasto pessoal', () => {
    expect(parseMessage('quanto eu gastei?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'me',
      months: 1,
    });
  });

  it('detecta gasto da família', () => {
    expect(parseMessage('quanto nós gastamos?')).toEqual({
      kind: 'query',
      intent: 'total',
      person: 'family',
      months: 1,
    });
  });

  it('detecta gasto por categoria', () => {
    expect(parseMessage('quanto gastamos com mercado?')).toMatchObject({
      kind: 'query',
      intent: 'by_category',
      categorySlug: 'mercado',
    });
  });

  it('detecta resumo das finanças', () => {
    expect(parseMessage('como estão nossas finanças?')).toEqual({
      kind: 'summary',
    });
    expect(parseMessage('como está o mês?')).toEqual({ kind: 'summary' });
  });

  it('detecta extrato', () => {
    expect(parseMessage('extrato')).toEqual({ kind: 'statement', filter: '' });
    expect(parseMessage('extrato hoje')).toEqual({
      kind: 'statement',
      filter: 'hoje',
    });
    expect(parseMessage('extrato semana')).toEqual({
      kind: 'statement',
      filter: 'semana',
    });
    expect(parseMessage('extrato agosto')).toEqual({
      kind: 'statement',
      filter: 'agosto',
    });
  });

  it('busca lançamentos em linguagem natural', () => {
    expect(parseMessage('mostra todas as compras do Nubank')).toMatchObject({
      kind: 'search',
      cardHint: 'Nubank',
    });
    expect(parseMessage('mostra gastos maiores que 500')).toMatchObject({
      kind: 'search',
      minAmount: 500,
    });
    expect(parseMessage('procura a compra da Amazon')).toMatchObject({
      kind: 'search',
      needle: 'Amazon',
    });
    expect(parseMessage('o que gastamos sexta?')).toMatchObject({
      kind: 'search',
      when: { kind: 'weekday', day: 5 },
    });
  });

  it('detecta previsão do mês', () => {
    expect(parseMessage('como devemos terminar o mês?')).toEqual({
      kind: 'forecast',
    });
    expect(parseMessage('previsão')).toEqual({ kind: 'forecast' });
    expect(parseMessage('como vai ficar o mês?')).toEqual({
      kind: 'forecast',
    });
  });

  it.each([
    ['gastei 45 no almoço', 'EXPENSE', 45],
    ['mercado 350', 'EXPENSE', 350],
    ['gastei 89 no posto', 'EXPENSE', 89],
    ['paguei 230 de energia', 'EXPENSE', 230],
    ['comprei um tênis de 350', 'EXPENSE', 350],
    ['recebi 5000 de salário', 'INCOME', 5000],
    ['recebi meu salário 5500', 'INCOME', 5500],
    ['entrou 1200 de freelance', 'INCOME', 1200],
    ['minha esposa recebeu 3500', 'INCOME', 3500],
    ['minha mãe me mandou 200 reais', 'INCOME', 200],
    ['120 de internet', 'EXPENSE', 120],
    ['transferi 500 do Nubank para o Inter', 'TRANSFER', 500],
    ['TED de 2000 do Bradesco para o Itaú', 'TRANSFER', 2000],
    ['fiz um pix de 500 para o Inter', 'TRANSFER', 500],
  ])('entende "%s"', (text, type, amount) => {
    expect(parseMessage(text)).toMatchObject({
      kind: 'movement',
      type,
      amount,
    });
  });

  it('corrige o valor da última transação', () => {
    expect(parseMessage('na verdade foram 46 reais')).toEqual({
      kind: 'correction',
      amount: 46,
    });
  });

  it('corrige a categoria', () => {
    expect(parseMessage('coloca como restaurante')).toEqual({
      kind: 'correction',
      categoryHint: 'restaurante',
    });
  });

  it('corrige com "coloca isso em Educação"', () => {
    expect(parseMessage('coloca isso em Educação')).toEqual({
      kind: 'correction',
      categoryHint: 'Educação',
    });
  });

  it('corrige o estabelecimento', () => {
    expect(parseMessage('foi no Nubank')).toEqual({
      kind: 'correction',
      merchant: 'Nubank',
    });
  });

  it('reconhece pagamento de conta pendente', () => {
    expect(parseMessage('paguei a energia')).toEqual({
      kind: 'bill_payment',
      hint: 'energia',
    });
  });

  it.each([
    ['todo dia 10 pago 292,80 do terreno', 292.8, 10, 'Terreno'],
    ['Netflix 55,90 todo dia 7', 55.9, 7, 'Netflix'],
    ['internet 120 todo dia 15', 120, 15, 'Internet'],
    ['academia 90 todo dia 5', 90, 5, 'Academia'],
  ])('reconhece recorrente "%s"', (text, amount, day, label) => {
    expect(parseMessage(text)).toEqual({
      kind: 'recurring_bill',
      amount,
      dayOfMonth: day,
      label,
    });
  });

  it('cadastra recorrente pelo comando com "dia 10"', () => {
    expect(parseRecurringBillFromCommand('Terreno 289 dia 10')).toEqual({
      kind: 'recurring_bill',
      amount: 289,
      dayOfMonth: 10,
      label: 'Terreno',
    });
  });

  it('reconhece parcelamento no cartão', () => {
    expect(parseMessage('comprei uma TV de 2400 em 10x no Nubank')).toEqual({
      kind: 'installment',
      amount: 2400,
      installmentCount: 10,
      card: 'Nubank',
      label: 'TV',
    });
  });

  it.each([
    ['orçamento mercado 1200', 'mercado', 1200],
    ['orçamento de restaurante 500', 'restaurante', 500],
    ['orçamento lazer 400', 'lazer', 400],
  ])('define orçamento "%s"', (text, slug, amount) => {
    expect(parseMessage(text)).toEqual({
      kind: 'budget',
      amount,
      categorySlug: slug,
    });
  });

  it('lista orçamentos sem valor', () => {
    expect(parseMessage('orçamento')).toEqual({ kind: 'budget_list' });
  });

  it('define meta mensal', () => {
    expect(parseMessage('queremos guardar 2000 por mês')).toEqual({
      kind: 'goal',
      amount: 2000,
    });
  });

  it('consulta a meta', () => {
    expect(parseMessage('como está a meta?')).toEqual({ kind: 'goal_status' });
    expect(parseMessage('meta')).toEqual({ kind: 'goal_status' });
    expect(parseMessage('metas')).toEqual({ kind: 'goal_status' });
  });

  it('consulta o que ainda falta pagar', () => {
    expect(parseMessage('quanto ainda temos para pagar?')).toEqual({
      kind: 'payable',
    });
    expect(parseMessage('contas futuras')).toEqual({ kind: 'payable' });
    expect(parseMessage('quanto falta pagar?')).toEqual({ kind: 'payable' });
  });

  it('cadastra cartão', () => {
    expect(
      parseMessage(
        'cartão Nubank limite 5000 fecha dia 22 vence dia 29',
      ),
    ).toEqual({
      kind: 'card',
      name: 'Nubank',
      creditLimit: 5000,
      closingDay: 22,
      dueDay: 29,
    });
  });

  it('lista limites dos cartões', () => {
    expect(parseMessage('limites')).toEqual({ kind: 'card_limits' });
    expect(parseMessage('limite')).toEqual({ kind: 'card_limits' });
  });

  it('apaga cartão', () => {
    expect(parseMessage('apaga o cartão Santander')).toEqual({
      kind: 'card_delete',
      name: 'Santander',
    });
    expect(parseMessage('apagar cartão Nubank')).toEqual({
      kind: 'card_delete',
      name: 'Nubank',
    });
  });

  it('informa limite já usado no cartão', () => {
    expect(parseMessage('cartão Santander - limite usado 4500')).toEqual({
      kind: 'card_used',
      name: 'Santander',
      amount: 4500,
    });
    expect(parseMessage('Santander usado 1200')).toEqual({
      kind: 'card_used',
      name: 'Santander',
      amount: 1200,
    });
  });

  it('não trata gasto no cartão como cadastro', () => {
    expect(parseMessage('gastei 120 no Nubank')).toMatchObject({
      kind: 'movement',
      type: 'EXPENSE',
      amount: 120,
    });
  });
});

describe('isAmbiguousTransfer', () => {
  it('pede confirmação para PIX a pessoa', () => {
    expect(isAmbiguousTransfer('fiz um pix de 500 para João')).toBe(true);
  });

  it('não pede confirmação para gasto explícito', () => {
    expect(isAmbiguousTransfer('gastei 39,90 na amazon')).toBe(false);
    expect(isAmbiguousTransfer('mercado 250')).toBe(false);
  });

  it('não pede confirmação para transferência entre bancos', () => {
    expect(isAmbiguousTransfer('transferi 500 do Nubank para o Inter')).toBe(
      false,
    );
    expect(isAmbiguousTransfer('fiz um pix de 500 para o Inter')).toBe(false);
  });
});
