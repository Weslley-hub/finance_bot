export type CartaoView = {
  name: string;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
};

export type CardLimitView = {
  name: string;
  creditLimit: number | null;
  used: number;
  available: number | null;
};

export function buildCartaoCard(card: CartaoView): string {
  const lines = [`💳 ${card.name}`];
  if (card.creditLimit != null) {
    lines.push(`Limite: ${formatMoney(card.creditLimit)}`);
  }
  if (card.closingDay != null) {
    lines.push(`Fecha: dia ${card.closingDay}`);
  }
  if (card.dueDay != null) {
    lines.push(`Vence: dia ${card.dueDay}`);
  }
  return lines.join('\n');
}

export function buildCartoesList(cards: CartaoView[]): string {
  if (cards.length === 0) {
    return [
      'Nenhum cartão cadastrado.',
      '',
      'Exemplo: cartão Nubank limite 5000 fecha dia 22 vence dia 29',
    ].join('\n');
  }

  return cards.map((card) => buildCartaoCard(card)).join('\n\n');
}

export function buildLimitesCard(cards: CardLimitView[]): string {
  if (cards.length === 0) {
    return [
      'Nenhum cartão cadastrado.',
      '',
      'Exemplo: /cartao Nubank limite 5000 fecha dia 22 vence dia 29',
    ].join('\n');
  }

  const blocks = cards.map((card) => {
    const lines = [`💳 ${card.name}`];
    if (card.creditLimit == null) {
      lines.push('Limite: não informado');
      return lines.join('\n');
    }

    lines.push(`Limite: ${formatMoney(card.creditLimit)}`);
    lines.push(`Usado: ${formatMoney(card.used)}`);
    lines.push(`Disponível: ${formatMoney(card.available ?? 0)}`);
    return lines.join('\n');
  });

  const withLimit = cards.filter((card) => card.creditLimit != null);
  const totalLimit = withLimit.reduce(
    (sum, card) => sum + (card.creditLimit ?? 0),
    0,
  );
  const totalUsed = cards.reduce((sum, card) => sum + card.used, 0);
  const totalAvailable = withLimit.reduce(
    (sum, card) => sum + (card.available ?? 0),
    0,
  );

  const totals = [
    '——',
    `Total limite: ${formatMoney(totalLimit)}`,
    `Total usado: ${formatMoney(totalUsed)}`,
    `Total disponível: ${formatMoney(totalAvailable)}`,
  ];

  return [
    '💳 Limites dos cartões',
    '',
    blocks.join('\n\n'),
    '',
    ...totals,
  ].join('\n');
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
