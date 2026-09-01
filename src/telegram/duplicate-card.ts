import { formatShortDate } from '../documents/document-extraction';
import { DuplicateHit } from '../transactions/duplicate';
import { formatMoney } from './movement-card';

export function buildDuplicateCard(hit: DuplicateHit): string {
  return [
    '⚠️ Possível duplicidade',
    '',
    'Já existe:',
    '',
    hit.title,
    formatMoney(hit.amount),
    formatShortDate(hit.createdAt),
    '',
    'Deseja adicionar mesmo assim?',
  ].join('\n');
}

export function duplicateKeyboard(id: string) {
  return {
    inline_keyboard: [
      [{ text: 'Não', callback_data: `dup:no:${id}` }],
      [{ text: 'Adicionar', callback_data: `dup:ok:${id}` }],
    ],
  };
}
