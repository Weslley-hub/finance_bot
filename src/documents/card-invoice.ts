import { parseAmount } from '../categories/message-parser';
import { normalizeText } from '../categories/text-normalize';
import { monthName, parseBrazilianDate } from './document-extraction';

export type CardInvoiceLine = {
  merchant: string;
  amount: number;
  date: Date | null;
};

export type InvoiceItemStatus = 'recognized' | 'review' | 'duplicate';

export type InvoiceCounts = {
  total: number;
  recognized: number;
  review: number;
  duplicates: number;
};

const SKIP =
  /\b(TOTAL|SUBTOTAL|PAGAMENTO(\s+RECEBIDO)?|VALOR\s+(TOTAL|DA\s+FATURA|MINIMO)|SALDO(\s+ANTERIOR)?|LIMITE|VENCIMENTO|FATURA\s+(FECHADA|ANTERIOR)|IOF|JUROS|MULTA|ENCARGOS?|CREDITO\s+ROTATIVO|PAGAMENTO\s+EM|NU\s+PAGAMENTOS|TRANSACOES|LANCAMENTOS)\b/;

const CARD_HINT =
  /\b(NUBANK|ITAU|ITAUCARD|INTER|C6|BRADESCO|SANTANDER|MASTERCARD|VISA|CARTAO|FATURA|INVOICE)\b/;

const KNOWN_CARDS: Array<{ key: string; name: string }> = [
  { key: 'NUBANK', name: 'Nubank' },
  { key: 'ITAUCARD', name: 'Itaú' },
  { key: 'ITAU', name: 'Itaú' },
  { key: 'INTER', name: 'Inter' },
  { key: 'BRADESCO', name: 'Bradesco' },
  { key: 'SANTANDER', name: 'Santander' },
  { key: 'C6', name: 'C6' },
  { key: 'NEXT', name: 'Next' },
  { key: 'PICPAY', name: 'PicPay' },
];

const AMOUNT_AT_END =
  /(?:r\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,6})|(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}))(?:\s*)$/i;

const DATE_PREFIX =
  /^(?:(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|(\d{1,2})\s+([A-Z]{3}))\s+/i;

const MONTH_HINT =
  /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i;

export function parseCardInvoiceItems(text: string): CardInvoiceLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: CardInvoiceLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = normalizeText(line);
    if (SKIP.test(normalized)) {
      continue;
    }

    let amount: number | null = null;
    let merchantRaw = '';

    const endMatch = line.match(AMOUNT_AT_END);
    if (endMatch && endMatch.index !== undefined) {
      const before = line.slice(0, endMatch.index).trim();
      const rawAmount = endMatch[1] ?? endMatch[2];
      if (before.length >= 2 && rawAmount) {
        amount = parseAmount(rawAmount);
        merchantRaw = before;
      }
    } else if (index + 1 < lines.length && isAmountOnly(lines[index + 1])) {
      amount = parseAmount(stripCurrency(lines[index + 1]));
      merchantRaw = line;
      index += 1;
    }

    if (!amount || amount <= 0) {
      continue;
    }

    const date = parseLineDate(merchantRaw);
    const merchant = cleanMerchant(merchantRaw);
    if (merchant.length < 2) {
      continue;
    }

    if (SKIP.test(normalizeText(merchant))) {
      continue;
    }

    items.push({ merchant, amount, date });
  }

  return items;
}

export function looksLikeCardInvoice(
  text: string,
  fileName?: string,
  itemCount = parseCardInvoiceItems(text).length,
): boolean {
  const name = normalizeText(fileName ?? '');
  if (/\b(FATURA|INVOICE)\b/.test(name) && itemCount >= 2) {
    return true;
  }

  const haystack = normalizeText(text);
  return itemCount >= 3 && CARD_HINT.test(haystack);
}

export function inferCardName(fileName?: string, text?: string): string {
  const haystack = normalizeText([fileName, text].filter(Boolean).join(' '));
  for (const card of KNOWN_CARDS) {
    if (haystack.includes(card.key)) {
      return card.name;
    }
  }

  const fromFile = (fileName ?? '')
    .replace(/\.[^.]+$/, '')
    .split(/[-_\s]+/)
    .map((part) => part.trim())
    .find(
      (part) =>
        part.length >= 3 &&
        !/^(fatura|invoice|cartao|pdf)$/i.test(part) &&
        !MONTH_HINT.test(part),
    );

  if (fromFile) {
    return fromFile[0].toUpperCase() + fromFile.slice(1).toLowerCase();
  }

  return 'Cartão';
}

export function inferInvoiceDate(
  fileName?: string,
  text?: string,
  at = new Date(),
): Date {
  const haystack = `${fileName ?? ''} ${text ?? ''}`;
  const monthMatch = haystack.match(MONTH_HINT);
  if (!monthMatch) {
    return at;
  }

  const names = Array.from({ length: 12 }, (_, index) =>
    normalizeText(monthName(index)),
  );
  const monthIndex = names.indexOf(normalizeText(monthMatch[1]));
  if (monthIndex < 0) {
    return at;
  }

  const yearMatch = haystack.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : at.getFullYear();
  return new Date(year, monthIndex, 15);
}

export function countInvoiceItems(
  items: Array<{ status: InvoiceItemStatus }>,
): InvoiceCounts {
  return {
    total: items.length,
    recognized: items.filter((item) => item.status === 'recognized').length,
    review: items.filter((item) => item.status === 'review').length,
    duplicates: items.filter((item) => item.status === 'duplicate').length,
  };
}

export function invoiceItemStatus(
  confidence: number,
  duplicate: boolean,
): InvoiceItemStatus {
  if (duplicate) {
    return 'duplicate';
  }

  return confidence >= 0.7 ? 'recognized' : 'review';
}

export function merchantNeedle(merchant: string): string {
  const words = merchant.split(/\s+/).filter((word) => word.length >= 3);
  return words[0] ?? merchant.slice(0, 24);
}

function isAmountOnly(line: string): boolean {
  return /^(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,6})$/i.test(
    line.trim(),
  );
}

function stripCurrency(line: string): string {
  return line.replace(/r\$/gi, '').trim();
}

function parseLineDate(merchant: string): Date | null {
  const match = merchant.match(DATE_PREFIX);
  if (!match) {
    return parseBrazilianDate(merchant.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)?.[1]);
  }

  if (match[1]) {
    return parseBrazilianDate(match[1]);
  }

  return null;
}

function cleanMerchant(raw: string): string {
  let value = raw
    .replace(DATE_PREFIX, '')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = value.split(' ').filter(Boolean);
  const collapsed: string[] = [];
  for (const word of words) {
    const previous = collapsed[collapsed.length - 1];
    if (!previous || previous.toLowerCase() !== word.toLowerCase()) {
      collapsed.push(word);
    }
  }

  return collapsed.join(' ').trim();
}
