import { TransactionType } from '@prisma/client';
import { formatMoney } from './movement-card';
import {
  formatFullDate,
  formatShortDate,
  monthName,
} from '../documents/document-extraction';
import { paymentTypeLabel } from '../documents/payment-classification';
import { PendingBillDraft, PendingReceiptDraft } from './pending-movements.store';

type CategoryLabel = { emoji: string; name: string };

export function buildReceiptPreview(
  draft: PendingReceiptDraft,
  category: CategoryLabel,
): string {
  if (draft.movementType === 'TRANSFER') {
    const from = draft.originBank ?? draft.bank ?? 'Origem';
    const to = draft.destinationBank ?? draft.destination ?? 'Destino';
    const method = paymentTypeLabel(draft.paymentType);
    const lines = [
      '🔁 Identifiquei uma transferência.',
      '',
      `${from} → ${to}`,
    ];
    if (method) {
      lines.push(method);
    }
    lines.push(
      formatMoney(draft.amount),
      draft.paidAt ? formatFullDate(draft.paidAt) : 'Hoje',
      '',
      'Não entra como despesa — evita contar o mesmo dinheiro duas vezes.',
    );
    return lines.join('\n');
  }

  const method = paymentTypeLabel(draft.paymentType);
  const lines = ['💡 Identifiquei um pagamento.', '', draft.destination ?? 'Pagamento'];
  if (method) {
    lines.push(method);
  }
  lines.push(
    formatMoney(draft.amount),
    draft.paidAt ? formatFullDate(draft.paidAt) : 'Hoje',
    '',
    'Categoria sugerida:',
    `${category.emoji} ${category.name}`,
  );
  return lines.join('\n');
}

export function receiptKeyboard(id: string, movementType?: TransactionType) {
  if (movementType === 'TRANSFER') {
    return {
      inline_keyboard: [
        [{ text: 'Confirmar transferência', callback_data: `rcpt:ok:${id}` }],
        [{ text: 'Registrar como despesa', callback_data: `rcpt:exp:${id}` }],
        [{ text: 'Editar', callback_data: `rcpt:edit:${id}` }],
        [{ text: 'Ignorar', callback_data: `rcpt:no:${id}` }],
      ],
    };
  }

  return {
    inline_keyboard: [
      [{ text: 'Confirmar', callback_data: `rcpt:ok:${id}` }],
      [{ text: 'É transferência', callback_data: `rcpt:tr:${id}` }],
      [{ text: 'Editar', callback_data: `rcpt:edit:${id}` }],
      [{ text: 'Ignorar', callback_data: `rcpt:no:${id}` }],
    ],
  };
}

export function buildBillPreview(
  draft: PendingBillDraft,
  category: CategoryLabel,
): string {
  const due = draft.dueDate ? formatShortDate(draft.dueDate) : '—';
  const month = monthName(draft.referenceMonth - 1);

  return [
    `${category.emoji} Conta de ${category.name.toLowerCase()}`,
    '',
    formatMoney(draft.amount),
    `Vence: ${due}`,
    '',
    `Adicionar às contas de ${month}?`,
  ].join('\n');
}

export function billKeyboard(id: string) {
  return {
    inline_keyboard: [
      [{ text: 'Adicionar', callback_data: `bill:add:${id}` }],
      [{ text: 'Já está paga', callback_data: `bill:paid:${id}` }],
      [{ text: 'Cancelar', callback_data: `bill:x:${id}` }],
    ],
  };
}
