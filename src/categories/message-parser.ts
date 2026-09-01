import {
  findBanks,
  inferMovementType,
  normalizePaymentType,
} from '../documents/payment-classification';
import { parseFinanceQuery, type ParsedQuery } from './finance-query';
import { parseSearch, type ParsedSearch } from './search-query';
import { matchCategoryKeyword } from './match-category-keywords';

export type { ParsedQuery, ParsedSearch };

export type ParsedMovement = {
  kind: 'movement';
  type: 'EXPENSE' | 'INCOME' | 'LOAN' | 'TRANSFER';
  amount: number;
  rest: string;
};

export type ParsedCorrection = {
  kind: 'correction';
  amount?: number;
  categoryHint?: string;
  merchant?: string;
};

export type ParsedBillPayment = {
  kind: 'bill_payment';
  hint: string;
};

export type ParsedUnknown = {
  kind: 'unknown';
  text: string;
};

export type ParsedRecurringBill = {
  kind: 'recurring_bill';
  amount: number;
  dayOfMonth: number;
  label: string;
};

export type ParsedInstallment = {
  kind: 'installment';
  amount: number;
  installmentCount: number;
  card: string | null;
  label: string;
};

export type ParsedSummary = {
  kind: 'summary';
};

export type ParsedForecast = {
  kind: 'forecast';
};

export type ParsedStatement = {
  kind: 'statement';
  filter: string;
};

export type ParsedBudget = {
  kind: 'budget';
  amount: number;
  categorySlug: string;
};

export type ParsedBudgetList = {
  kind: 'budget_list';
};

export type ParsedGoal = {
  kind: 'goal';
  amount: number;
};

export type ParsedGoalStatus = {
  kind: 'goal_status';
};

export type ParsedPayable = {
  kind: 'payable';
};

export type ParsedCard = {
  kind: 'card';
  name: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
};

export type ParsedCardList = {
  kind: 'card_list';
};

export type ParsedCardDelete = {
  kind: 'card_delete';
  name: string;
};

export type ParsedCardLimits = {
  kind: 'card_limits';
};

export type ParsedCardUsed = {
  kind: 'card_used';
  name: string;
  amount: number;
};

export type ParsedMessage =
  | ParsedQuery
  | ParsedMovement
  | ParsedCorrection
  | ParsedBillPayment
  | ParsedRecurringBill
  | ParsedInstallment
  | ParsedSummary
  | ParsedForecast
  | ParsedStatement
  | ParsedSearch
  | ParsedBudget
  | ParsedBudgetList
  | ParsedGoal
  | ParsedGoalStatus
  | ParsedPayable
  | ParsedCard
  | ParsedCardList
  | ParsedCardDelete
  | ParsedCardLimits
  | ParsedCardUsed
  | ParsedUnknown;

const QUERY_STATEMENT = /^(?:\/)?extrato\b/i;

const QUERY_FORECAST =
  /\bcomo\s+(devemos|vamos|vou|vai|ficamos|fica)\s+terminar\s+o\s+m[eê]s\b|\bprevis[aã]o(\s+do\s+m[eê]s)?\b|\b(como\s+vai\s+ficar|como\s+fica)\s+o\s+m[eê]s\b|\bsaldo\s+(projetado|no\s+fim)\b/i;

const QUERY_SUMMARY =
  /\bcomo est[aã]o\s+(as\s+|nossas\s+)?finan|\bresumo(\s+do\s+m[eê]s)?\b|\bcomo est[aá]\s+o\s+m[eê]s\b/i;

const EXPENSE_PREFIX =
  /\b(gastei|gastos?|paguei|saiu|despesa|comprei)\b/i;
const INCOME_PREFIX =
  /\b(recebi|recebeu|ganhei|ganhou|entrou|renda|me mandou|me enviou|me transferiu)\b/i;
const INCOME_HINT =
  /\b(sal[aá]rio|freelance|reembolso|estorno|rendimento|dividendo|holerite)\b/i;
const LOAN_PREFIX = /\b(emprestei|emprestado)\b/i;

const AMOUNT_PATTERN =
  /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+(?:[.,]\d{1,2})?)(?:\s*reais?)?/i;

const CORRECTION_AMOUNT =
  /(?:na verdade|na vdd|corrig[ei]|era|eram|foi|foram)\s+(?:foram\s+|foi\s+|é\s+)?(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?/i;

const CORRECTION_CATEGORY =
  /(?:coloca(?:r)?|muda(?:r)?|troca(?:r)?|deixa(?:r)?)\s+(?:isso\s+|essa\s+|este\s+|essa\s+despesa\s+)?(?:como|pra|para|pro|em|na|no)\s+(.+)/i;

const CORRECTION_MERCHANT =
  /^(?:foi|paguei)\s+(?:no|na|pelo|pela|em)\s+(.+)$/i;

const BILL_PAYMENT =
  /^(?:paguei|pagamos|j[aá]\s+paguei)\s+(?:a\s+|o\s+|as\s+)?(?:conta\s+(?:de\s+)?)?(.+)$/i;

const RECURRING_DAY = /\btodo\s+dia\s+(\d{1,2})\b/i;
const INSTALLMENT_COUNT = /\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i;

const BUDGET_PREFIX = /\bor[cç]amento\b/i;
const BUDGET_LIST_ONLY = /^or[cç]amentos?$/i;
const GOAL_SAVE = /\b(guardar|economizar|poupar|juntar)\b/i;
const GOAL_WORD = /\bmeta\b/i;
const GOAL_STATUS = /^(?:\/)?metas?$/i;
const GOAL_ASK =
  /\b(como est[aá]|qual(\s+[eé])?)\s+(a\s+)?meta\b|\bmeta\s+mensal\b/i;
const PAYABLE_QUERY =
  /\bquanto\s+(ainda\s+)?(n[oó]s\s+)?(temos|tenho|falta)\s+(ainda\s+)?((para|pra|que)\s+)?pagar\b|\b(ainda\s+)?(temos|falta|faltam)\s+(para|pra|que\s+)?pagar\b|\bo\s+que\s+(ainda\s+)?(temos|falta)\s+(para|pra|que\s+)?pagar\b|\bcontas\s+futuras\b|\bfaltam?\s+pagar\b/i;
const CARD_WORD = /\bcart[aã]o\b/i;
const CARD_LIST_ONLY = /^cart(?:oes|ões|[aã]o)$/i;
const CARD_CLOSE = /\bfecha(?:\s+dia)?\s+(\d{1,2})\b/i;
const CARD_DUE = /\bvence(?:\s+dia)?\s+(\d{1,2})\b/i;
const CARD_DELETE =
  /^(?:apaga(?:r)?|remove(?:r)?|exclui(?:r)?|deleta(?:r)?)\s+(?:o\s+|os\s+)?(?:cart[aã]os?\s+)?(.+)$/i;
const CARD_LIMITS_ONLY = /^limites?(?:\s+dos?\s+cart[aã]os?)?$/i;
const CARD_USED =
  /^(?:cart[aã]o\s+)?(.+?)\s*[-–,]\s*(?:limite\s+)?usado(?:\s+de)?\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+(?:[.,]\d{1,2})?)(?:\s*reais?)?$/i;
const CARD_USED_PLAIN =
  /^(?:cart[aã]o\s+)?(.+?)\s+(?:limite\s+)?usado(?:\s+de)?\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+(?:[.,]\d{1,2})?)(?:\s*reais?)?$/i;

const AMBIGUOUS_TRANSFER =
  /\b(fiz\s+(um\s+)?pix|pix\s+de|transferi|enviei|mandei)\b[\s\S]*\b(para|pra|pro)\b/i;

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/r\$/gi, '').replace(/\s*reais?/gi, '').trim();
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

export function isAmbiguousTransfer(text: string): boolean {
  if (EXPENSE_PREFIX.test(text) || INCOME_PREFIX.test(text)) {
    return false;
  }

  if (isBankToBankTransfer(text)) {
    return false;
  }

  return AMBIGUOUS_TRANSFER.test(text);
}

export function isBankToBankTransfer(text: string): boolean {
  return (
    inferMovementType({
      text,
      paymentType: normalizePaymentType(text),
    }) === 'TRANSFER'
  );
}

export function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();

  const correction = parseCorrection(trimmed);
  if (correction) {
    return correction;
  }

  const recurring = parseRecurringBill(trimmed);
  if (recurring) {
    return recurring;
  }

  const installment = parseInstallment(trimmed);
  if (installment) {
    return installment;
  }

  const billPayment = parseBillPayment(trimmed);
  if (billPayment) {
    return billPayment;
  }

  if (QUERY_FORECAST.test(trimmed)) {
    return { kind: 'forecast' };
  }

  if (QUERY_STATEMENT.test(trimmed)) {
    return {
      kind: 'statement',
      filter: trimmed.replace(/^(?:\/)?extrato\b/i, '').trim(),
    };
  }

  const search = parseSearch(trimmed);
  if (search) {
    return search;
  }

  if (QUERY_SUMMARY.test(trimmed)) {
    return { kind: 'summary' };
  }

  if (PAYABLE_QUERY.test(trimmed)) {
    return { kind: 'payable' };
  }

  const goal = parseGoal(trimmed);
  if (goal) {
    return goal;
  }

  const financeQuery = parseFinanceQuery(trimmed);
  if (financeQuery) {
    return financeQuery;
  }

  const budget = parseBudget(trimmed);
  if (budget) {
    return budget;
  }

  const cardLimits = CARD_LIMITS_ONLY.test(trimmed)
    ? ({ kind: 'card_limits' } as const)
    : null;
  if (cardLimits) {
    return cardLimits;
  }

  const cardUsed = parseCardUsed(trimmed);
  if (cardUsed) {
    return cardUsed;
  }

  const cardDelete = parseCardDelete(trimmed);
  if (cardDelete) {
    return cardDelete;
  }

  const card = parseCard(trimmed);
  if (card) {
    return card;
  }

  const amountMatch = trimmed.match(AMOUNT_PATTERN);
  if (!amountMatch) {
    return { kind: 'unknown', text: trimmed };
  }

  const amount = parseAmount(amountMatch[1]);
  if (amount === null) {
    return { kind: 'unknown', text: trimmed };
  }

  const type = detectType(trimmed);
  const rest = `${trimmed.slice(0, amountMatch.index)}${trimmed.slice(
    (amountMatch.index ?? 0) + amountMatch[0].length,
  )}`
    .replace(EXPENSE_PREFIX, ' ')
    .replace(INCOME_PREFIX, ' ')
    .replace(LOAN_PREFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    kind: 'movement',
    type,
    amount,
    rest,
  };
}

function detectType(text: string): ParsedMovement['type'] {
  if (LOAN_PREFIX.test(text)) {
    return 'LOAN';
  }

  const isIncome = INCOME_PREFIX.test(text) || INCOME_HINT.test(text);
  const isExpense = EXPENSE_PREFIX.test(text);
  if (isIncome && !isExpense) {
    return 'INCOME';
  }

  if (isBankToBankTransfer(text) || findBanks(text).length >= 2) {
    return 'TRANSFER';
  }

  return 'EXPENSE';
}

function parseCorrection(text: string): ParsedCorrection | null {
  const amountMatch = text.match(CORRECTION_AMOUNT);
  if (amountMatch && /na verdade|na vdd|corrig|eram?|foram/i.test(text)) {
    const amount = parseAmount(amountMatch[1]);
    if (amount !== null) {
      return { kind: 'correction', amount };
    }
  }

  const categoryMatch = text.match(CORRECTION_CATEGORY);
  if (categoryMatch) {
    return { kind: 'correction', categoryHint: categoryMatch[1].trim() };
  }

  const merchantMatch = text.match(CORRECTION_MERCHANT);
  if (merchantMatch && !AMOUNT_PATTERN.test(text)) {
    return { kind: 'correction', merchant: merchantMatch[1].trim() };
  }

  return null;
}

export function parseBudget(
  text: string,
): ParsedBudget | ParsedBudgetList | null {
  const trimmed = text.trim();
  if (BUDGET_LIST_ONLY.test(trimmed)) {
    return { kind: 'budget_list' };
  }

  if (!BUDGET_PREFIX.test(trimmed) || /\b(quanto|qual|quais|como)\b/i.test(trimmed)) {
    return null;
  }

  const amountMatch = trimmed.match(AMOUNT_PATTERN);
  if (!amountMatch) {
    return { kind: 'budget_list' };
  }

  const amount = parseAmount(amountMatch[1]);
  if (amount === null) {
    return null;
  }

  const categorySlug = matchCategoryKeyword(trimmed);
  if (!categorySlug) {
    return null;
  }

  return {
    kind: 'budget',
    amount,
    categorySlug,
  };
}

export function parseGoal(text: string): ParsedGoal | ParsedGoalStatus | null {
  const trimmed = text.trim();
  const hasAmount = AMOUNT_PATTERN.test(trimmed);
  const isSave = GOAL_SAVE.test(trimmed);

  if (GOAL_STATUS.test(trimmed) || (GOAL_ASK.test(trimmed) && !hasAmount)) {
    return { kind: 'goal_status' };
  }

  if (!isSave && !(GOAL_WORD.test(trimmed) && hasAmount)) {
    return null;
  }

  if (GOAL_ASK.test(trimmed) && !isSave) {
    return { kind: 'goal_status' };
  }

  const amountMatch = trimmed.match(AMOUNT_PATTERN);
  if (!amountMatch) {
    return { kind: 'goal_status' };
  }

  const amount = parseAmount(amountMatch[1]);
  if (amount === null) {
    return null;
  }

  return { kind: 'goal', amount };
}

export function parseCardDelete(text: string): ParsedCardDelete | null {
  const match = text.trim().match(CARD_DELETE);
  if (!match?.[1]) {
    return null;
  }

  const name = match[1]
    .replace(/^(?:o\s+|os\s+)/i, '')
    .replace(/\bcart[aã]os?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 2) {
    return null;
  }

  return { kind: 'card_delete', name: titleCaseLabel(name) };
}

export function parseCardUsed(text: string): ParsedCardUsed | null {
  const trimmed = text.trim();
  const match = trimmed.match(CARD_USED) ?? trimmed.match(CARD_USED_PLAIN);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const amount = parseAmount(match[2]);
  if (amount === null || amount < 0) {
    return null;
  }

  const name = match[1]
    .replace(/^(?:o\s+|os\s+)/i, '')
    .replace(/\bcart[aã]os?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 2 || /^(apaga|remove|exclui|deleta)/i.test(name)) {
    return null;
  }

  return { kind: 'card_used', name: titleCaseLabel(name), amount };
}

export function parseCard(text: string): ParsedCard | ParsedCardList | null {
  const trimmed = text.trim();
  if (CARD_LIST_ONLY.test(trimmed)) {
    return { kind: 'card_list' };
  }

  if (!CARD_WORD.test(trimmed) || EXPENSE_PREFIX.test(trimmed)) {
    return null;
  }

  const closeMatch = trimmed.match(CARD_CLOSE);
  const dueMatch = trimmed.match(CARD_DUE);
  const amountMatch = trimmed.match(AMOUNT_PATTERN);
  if (!closeMatch || !dueMatch || !amountMatch) {
    return CARD_WORD.test(trimmed) && !AMOUNT_PATTERN.test(trimmed)
      ? { kind: 'card_list' }
      : null;
  }

  const creditLimit = parseAmount(amountMatch[1]);
  const closingDay = Number(closeMatch[1]);
  const dueDay = Number(dueMatch[1]);
  if (
    creditLimit === null ||
    closingDay < 1 ||
    closingDay > 31 ||
    dueDay < 1 ||
    dueDay > 31
  ) {
    return null;
  }

  const name = trimmed
    .replace(CARD_WORD, ' ')
    .replace(CARD_CLOSE, ' ')
    .replace(CARD_DUE, ' ')
    .replace(/\blimite\b/gi, ' ')
    .replace(amountMatch[0], ' ')
    .replace(/\b(de|do|da|dia|o|a)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 2) {
    return null;
  }

  return {
    kind: 'card',
    name: titleCaseLabel(name),
    creditLimit,
    closingDay,
    dueDay,
  };
}

function parseBillPayment(text: string): ParsedBillPayment | null {
  if (AMOUNT_PATTERN.test(text)) {
    return null;
  }

  const match = text.match(BILL_PAYMENT);
  if (!match) {
    return null;
  }

  return {
    kind: 'bill_payment',
    hint: match[1].trim(),
  };
}

export function parseRecurringBill(text: string): ParsedRecurringBill | null {
  const dayMatch = text.match(RECURRING_DAY);
  if (!dayMatch) {
    return null;
  }

  const dayOfMonth = Number(dayMatch[1]);
  if (dayOfMonth < 1 || dayOfMonth > 31) {
    return null;
  }

  const withoutDay = text.replace(RECURRING_DAY, ' ');
  const amountMatch = withoutDay.match(AMOUNT_PATTERN);
  if (!amountMatch) {
    return null;
  }

  const amount = parseAmount(amountMatch[1]);
  if (amount === null) {
    return null;
  }

  const label = withoutDay
    .replace(amountMatch[0], ' ')
    .replace(/\b(pago|paguei|pagamos|pagar|conta)\b/gi, ' ')
    .replace(/\b(do|da|de|dos|das|o|a|os|as)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!label) {
    return null;
  }

  return {
    kind: 'recurring_bill',
    amount,
    dayOfMonth,
    label: titleCaseLabel(label),
  };
}

export function parseRecurringBillFromCommand(
  args: string,
): ParsedRecurringBill | null {
  const trimmed = args.trim();
  if (!trimmed) {
    return null;
  }

  const withTodoDia = /\btodo\s+dia\s+\d/i.test(trimmed)
    ? trimmed
    : trimmed.replace(/\bdia\s+(\d{1,2})\b/i, 'todo dia $1');

  return parseRecurringBill(withTodoDia);
}

export function parseInstallment(text: string): ParsedInstallment | null {
  const countMatch = text.match(INSTALLMENT_COUNT);
  if (!countMatch) {
    return null;
  }

  const installmentCount = Number(countMatch[1]);
  if (installmentCount < 2 || installmentCount > 48) {
    return null;
  }

  const withoutCount = text.replace(INSTALLMENT_COUNT, ' ');
  const amountMatch = withoutCount.match(AMOUNT_PATTERN);
  if (!amountMatch) {
    return null;
  }

  const amount = parseAmount(amountMatch[1]);
  if (amount === null) {
    return null;
  }

  const banks = findBanks(text);
  const card = banks[0] ?? cardFromSuffix(withoutCount);

  let label = withoutCount
    .replace(amountMatch[0], ' ')
    .replace(EXPENSE_PREFIX, ' ')
    .replace(/\b(uma|um|uns|umas|de|em|no|na|do|da|dos|das|pelo|pela|cartao)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (card) {
    label = label.replace(new RegExp(`\\b${card}\\b`, 'ig'), ' ').trim();
  }

  label = label.replace(/\s+/g, ' ').trim();
  if (!label) {
    label = 'Compra';
  }

  return {
    kind: 'installment',
    amount,
    installmentCount,
    card,
    label: prettyItemLabel(label),
  };
}

function cardFromSuffix(text: string): string | null {
  const match = text.match(/\bno\s+(?:cart[aã]o\s+)?(.+)$/i);
  if (!match) {
    return null;
  }

  const name = match[1].trim();
  return name ? titleCaseLabel(name) : null;
}

function prettyItemLabel(value: string): string {
  if (value.length <= 3) {
    return value.toUpperCase();
  }

  return titleCaseLabel(value);
}

function titleCaseLabel(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
