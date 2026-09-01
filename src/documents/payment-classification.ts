import { TransactionType } from '@prisma/client';
import { normalizeText } from '../categories/text-normalize';

export type PaymentType =
  | 'PIX'
  | 'TED'
  | 'BOLETO'
  | 'CARD'
  | 'TRANSFER'
  | 'PAYMENT';

export const BANKS: Array<{ key: string; label: string }> = [
  { key: 'NU PAGAMENTOS', label: 'Nubank' },
  { key: 'NUBANK', label: 'Nubank' },
  { key: 'BANCO INTER', label: 'Inter' },
  { key: 'INTER', label: 'Inter' },
  { key: 'ITAU UNIBANCO', label: 'Itaú' },
  { key: 'ITAU', label: 'Itaú' },
  { key: 'BRADESCO', label: 'Bradesco' },
  { key: 'BANCO DO BRASIL', label: 'Banco do Brasil' },
  { key: 'SANTANDER', label: 'Santander' },
  { key: 'C6 BANK', label: 'C6 Bank' },
  { key: 'C6BANK', label: 'C6 Bank' },
  { key: 'PICPAY', label: 'PicPay' },
  { key: 'MERCADO PAGO', label: 'Mercado Pago' },
  { key: 'PAGSEGURO', label: 'PagBank' },
  { key: 'PAGBANK', label: 'PagBank' },
  { key: 'CAIXA ECONOMICA', label: 'Caixa' },
  { key: 'NEON', label: 'Neon' },
  { key: 'SICOOB', label: 'Sicoob' },
  { key: 'SICREDI', label: 'Sicredi' },
  { key: 'BANCO ORIGINAL', label: 'Original' },
];

export function paymentTypeLabel(type: PaymentType | null | undefined): string {
  switch (type) {
    case 'PIX':
      return 'PIX';
    case 'TED':
      return 'TED';
    case 'BOLETO':
      return 'Boleto';
    case 'CARD':
      return 'Cartão';
    case 'TRANSFER':
      return 'Transferência';
    case 'PAYMENT':
      return 'Pagamento';
    default:
      return '';
  }
}

export function normalizePaymentType(value?: string | null): PaymentType | null {
  if (!value) {
    return null;
  }

  const text = normalizeText(value);

  if (text.includes('PIX')) {
    return 'PIX';
  }
  if (text.includes('TED') || /\bDOC\b/.test(text)) {
    return 'TED';
  }
  if (text.includes('BOLETO')) {
    return 'BOLETO';
  }
  if (
    text.includes('CARTAO') ||
    /\bCREDITO\b/.test(text) ||
    /\bDEBITO\b/.test(text)
  ) {
    return 'CARD';
  }
  if (text.includes('TRANSFERENCIA') || text.includes('TRANSFER')) {
    return 'TRANSFER';
  }
  if (text.includes('PAGAMENTO') || text.includes('PAYMENT')) {
    return 'PAYMENT';
  }

  return null;
}

export function findBanksInOrder(text: string): string[] {
  const haystack = normalizeText(text);
  const hits: Array<{ index: number; label: string }> = [];

  for (const bank of [...BANKS].sort((a, b) => b.key.length - a.key.length)) {
    if (hits.some((hit) => hit.label === bank.label)) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(bank.key)}\\b`);
    const index = haystack.search(pattern);
    if (index >= 0) {
      hits.push({ index, label: bank.label });
    }
  }

  return hits.sort((a, b) => a.index - b.index).map((hit) => hit.label);
}

export function findBanks(text: string): string[] {
  return findBanksInOrder(text);
}

export function inferMovementType(input: {
  text?: string | null;
  paymentType?: PaymentType | null;
  originBank?: string | null;
  destinationBank?: string | null;
  destination?: string | null;
  supplier?: string | null;
  bank?: string | null;
}): TransactionType {
  const blob = normalizeText(
    [
      input.text,
      input.paymentType,
      input.originBank,
      input.destinationBank,
      input.destination,
      input.supplier,
      input.bank,
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (/\b(RECEBI|RECEBIDO|DEPOSITO|ENTROU|CASH IN)\b/.test(blob)) {
    return 'INCOME';
  }

  const origin = input.originBank ?? input.bank ?? null;
  const destinationBank = input.destinationBank ?? null;
  const counterparty = input.destination ?? input.supplier ?? '';
  const banks = findBanks(blob);
  const counterpartyIsBank =
    findBanks(counterparty).length > 0 ||
    destinationLooksLikeBank(input.text ?? '');

  if (origin && destinationBank && origin !== destinationBank) {
    return 'TRANSFER';
  }

  if (banks.length >= 2) {
    return 'TRANSFER';
  }

  if (
    (input.paymentType === 'TRANSFER' ||
      input.paymentType === 'TED' ||
      input.paymentType === 'PIX') &&
    counterpartyIsBank
  ) {
    return 'TRANSFER';
  }

  return 'EXPENSE';
}

export function destinationLooksLikeBank(text: string): boolean {
  const match = text.match(
    /(?:para|pra|pro|destino|favorecido)[:\s]+(?:o\s+|a\s+|ao\s+|à\s+)?([^\n,]+)/i,
  );
  if (!match) {
    return false;
  }

  return findBanks(match[1]).length > 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
