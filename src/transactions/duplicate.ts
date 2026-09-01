import { TransactionType } from '@prisma/client';
import { stripNoiseWords } from '../categories/text-normalize';
import { roundMoney } from '../reports/resumo-card';

export type DuplicateProbe = {
  userId: string;
  type: TransactionType;
  amount: number;
  at: Date;
  description: string;
  merchant?: string | null;
  rawText?: string | null;
  categoryId?: string | null;
  paymentType?: string | null;
};

export type DuplicateCandidate = {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  createdAt: Date;
  description: string;
  merchant?: string | null;
  rawText?: string | null;
  categoryId: string;
  categoryName?: string | null;
};

export type DuplicateHit = {
  id: string;
  title: string;
  amount: number;
  createdAt: Date;
};

const GENERIC_TOKENS = new Set([
  'PAGAMENTO',
  'COMPROVANTE',
  'OUTROS',
  'DESTINO',
  'FATURA',
  'VALOR',
  'PIX',
  'TED',
  'BOLETO',
  'CARTAO',
  'TRANSFERENCIA',
  'RECEIPT',
]);

export function duplicateTokens(text: string): string[] {
  return stripNoiseWords(text)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !GENERIC_TOKENS.has(word) && !/^\d+$/.test(word));
}

export function hasTokenOverlap(left: string, right: string): boolean {
  const needles = duplicateTokens(left);
  const haystack = duplicateTokens(right);
  if (needles.length === 0 || haystack.length === 0) {
    return false;
  }

  return needles.some((needle) =>
    haystack.some(
      (token) =>
        token === needle ||
        (needle.length >= 5 && token.length >= 5 && (token.includes(needle) || needle.includes(token))),
    ),
  );
}

export function isGenericDuplicateLabel(...parts: Array<string | null | undefined>): boolean {
  return duplicateTokens(parts.filter(Boolean).join(' ')).length === 0;
}

export function closeInTime(left: Date, right: Date): boolean {
  const sameDay =
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (sameDay) {
    return true;
  }

  return Math.abs(left.getTime() - right.getTime()) <= 36 * 60 * 60 * 1000;
}

export function blobForDuplicate(input: {
  description?: string | null;
  merchant?: string | null;
  rawText?: string | null;
  categoryName?: string | null;
}): string {
  return [input.merchant, input.description, input.rawText, input.categoryName]
    .filter(Boolean)
    .join(' ');
}

export function duplicateTitle(input: {
  merchant?: string | null;
  description?: string | null;
  categoryName?: string | null;
}): string {
  if (input.description && !isGenericDuplicateLabel(input.description)) {
    return input.description;
  }

  if (input.categoryName && !isGenericDuplicateLabel(input.categoryName)) {
    return input.categoryName;
  }

  if (input.merchant && !isGenericDuplicateLabel(input.merchant)) {
    return input.merchant;
  }

  return input.categoryName || input.description || 'Lançamento';
}

export function isPossibleDuplicate(
  probe: DuplicateProbe,
  candidate: DuplicateCandidate,
): boolean {
  if (probe.userId !== candidate.userId) {
    return false;
  }

  if (probe.type !== candidate.type) {
    return false;
  }

  if (roundMoney(probe.amount) !== roundMoney(Number(candidate.amount))) {
    return false;
  }

  if (!closeInTime(probe.at, candidate.createdAt)) {
    return false;
  }

  const overlap = hasTokenOverlap(
    blobForDuplicate(probe),
    blobForDuplicate({
      ...candidate,
      categoryName: candidate.categoryName,
    }),
  );
  const sameCategory = Boolean(
    probe.categoryId && probe.categoryId === candidate.categoryId,
  );
  const generic =
    isGenericDuplicateLabel(probe.merchant, probe.description, probe.rawText) ||
    isGenericDuplicateLabel(
      candidate.merchant,
      candidate.description,
      candidate.rawText,
    );

  return overlap || sameCategory || generic;
}

export function pickDuplicate(
  probe: DuplicateProbe,
  candidates: DuplicateCandidate[],
): DuplicateHit | null {
  const match = candidates.find((candidate) =>
    isPossibleDuplicate(probe, candidate),
  );
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    title: duplicateTitle(match),
    amount: roundMoney(Number(match.amount)),
    createdAt: match.createdAt,
  };
}
