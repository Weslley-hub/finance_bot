export type HistoryAction = 'CREATED' | 'UPDATED' | 'DELETED';

export type TransactionSnapshot = {
  amount: number;
  type: string;
  description: string;
  merchant: string | null;
  categoryId: string;
  subcategoryId: string | null;
  transactionDate: string;
};

export function transactionSnapshot(row: {
  amount: unknown;
  type: string;
  description: string;
  merchant?: string | null;
  categoryId: string;
  subcategoryId?: string | null;
  transactionDate: Date;
}): TransactionSnapshot {
  return {
    amount: Number(row.amount),
    type: row.type,
    description: row.description,
    merchant: row.merchant ?? null,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId ?? null,
    transactionDate: row.transactionDate.toISOString(),
  };
}

export function asSnapshot(value: unknown): TransactionSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<TransactionSnapshot>;
  if (typeof data.amount !== 'number' || typeof data.description !== 'string') {
    return null;
  }

  return {
    amount: data.amount,
    type: typeof data.type === 'string' ? data.type : 'EXPENSE',
    description: data.description,
    merchant: data.merchant ?? null,
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : '',
    subcategoryId: data.subcategoryId ?? null,
    transactionDate:
      typeof data.transactionDate === 'string'
        ? data.transactionDate
        : new Date().toISOString(),
  };
}

export function formatHistoryLine(entry: {
  action: HistoryAction;
  changedByName: string;
  previousValue: TransactionSnapshot | null;
  newValue: TransactionSnapshot | null;
  createdAt: Date;
}): string {
  const who = entry.changedByName.trim().split(/\s+/)[0] || entry.changedByName;
  const when = entry.createdAt.toLocaleString('pt-BR');
  const current = entry.newValue ?? entry.previousValue;
  const label = current?.description ?? 'lançamento';

  if (entry.action === 'CREATED' && entry.newValue) {
    return [
      `${who} registrou ${label}`,
      formatMoney(entry.newValue.amount),
      when,
    ].join('\n');
  }

  if (entry.action === 'DELETED' && entry.previousValue) {
    return [
      `${who} arquivou ${label}`,
      formatMoney(entry.previousValue.amount),
      when,
    ].join('\n');
  }

  const previous = entry.previousValue;
  const next = entry.newValue;
  const amountLine =
    previous && next && previous.amount !== next.amount
      ? `${formatMoney(previous.amount)} → ${formatMoney(next.amount)}`
      : next
        ? formatMoney(next.amount)
        : previous
          ? formatMoney(previous.amount)
          : '';

  return [`${who} alterou ${label}`, amountLine, when]
    .filter(Boolean)
    .join('\n');
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
