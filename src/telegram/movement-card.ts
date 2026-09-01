import { TransactionType } from '@prisma/client';
import { TransactionWithCard } from '../transactions/transactions.service';

export function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatWhen(date: Date): string {
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return 'Hoje';
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ontem';
  }

  return date.toLocaleDateString('pt-BR');
}

export function formatMonthYear(date: Date): string {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${months[date.getMonth()]}/${date.getFullYear()}`;
}

export function typeTitle(type: TransactionType): string {
  if (type === 'INCOME') {
    return '💵 Receita registrada';
  }
  if (type === 'TRANSFER') {
    return '✅ Transferência registrada';
  }
  if (type === 'LOAN') {
    return '✅ Empréstimo registrado';
  }
  if (type === 'REFUND') {
    return '↩️ Estorno registrado';
  }
  return '✅ Despesa registrada';
}

export function buildMovementCard(tx: TransactionWithCard): string {
  if (tx.type === 'INCOME') {
    return [
      typeTitle(tx.type),
      '',
      tx.subcategory?.name ?? tx.category.name,
      formatMoney(Number(tx.amount)),
      '',
      formatMonthYear(tx.transactionDate),
      tx.user.name,
    ].join('\n');
  }

  if (tx.type === 'TRANSFER') {
    return [
      typeTitle(tx.type),
      '',
      tx.merchant || tx.description,
      '',
      formatMoney(Number(tx.amount)),
      '',
      formatWhen(tx.transactionDate),
      tx.user.name,
    ].join('\n');
  }

  const leaf = tx.subcategory ?? tx.category;
  const top = tx.subcategory ? tx.category : tx.category.parent ?? tx.category;
  const detail = tx.subcategory
    ? tx.subcategory.name
    : tx.merchant && tx.merchant.toLowerCase() !== leaf.name.toLowerCase()
      ? tx.merchant
      : tx.description !== leaf.name
        ? tx.description
        : undefined;

  const lines = [
    typeTitle(tx.type),
    '',
    `${top.emoji} ${top.name}`,
  ];

  if (detail) {
    lines.push(detail);
  }

  lines.push(
    '',
    formatMoney(Number(tx.amount)),
    '',
    formatWhen(tx.transactionDate),
    tx.user.name,
  );

  if (tx.cardInvoice?.card) {
    const due = tx.cardInvoice.dueDate.toLocaleDateString('pt-BR');
    const closes = tx.cardInvoice.closingDate.toLocaleDateString('pt-BR');
    lines.push(
      '',
      `💳 Fatura ${tx.cardInvoice.card.name}`,
      `Fecha ${closes} · Vence ${due}`,
    );
  }

  return lines.join('\n');
}

export function movementKeyboard(transactionId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Editar', callback_data: `tx:edit:${transactionId}` },
        { text: 'Excluir', callback_data: `tx:del:${transactionId}` },
      ],
    ],
  };
}

export function pendingKeyboard(draftId: string) {
  return {
    inline_keyboard: [
      [{ text: 'Despesa', callback_data: `pend:exp:${draftId}` }],
      [{ text: 'Transferência', callback_data: `pend:tr:${draftId}` }],
      [{ text: 'Empréstimo', callback_data: `pend:loan:${draftId}` }],
      [{ text: 'Cancelar', callback_data: `pend:x:${draftId}` }],
    ],
  };
}
