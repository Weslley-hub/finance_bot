import { shiftMonth } from '../installments/installment-split';
import { dueDateOn } from '../recurring/recurring-schedule';

export type InvoiceCycle = {
  referenceMonth: number;
  referenceYear: number;
  closingDate: Date;
  dueDate: Date;
};

export function invoiceCycleFor(
  closingDay: number,
  dueDay: number,
  at = new Date(),
): InvoiceCycle {
  let year = at.getFullYear();
  let month = at.getMonth() + 1;

  if (at.getDate() > closingDay) {
    const next = shiftMonth(year, month, 1);
    year = next.year;
    month = next.month;
  }

  const closingDate = dueDateOn(year, month, closingDay);
  let dueYear = year;
  let dueMonth = month;
  if (dueDay < closingDay) {
    const next = shiftMonth(year, month, 1);
    dueYear = next.year;
    dueMonth = next.month;
  }

  return {
    referenceMonth: month,
    referenceYear: year,
    closingDate,
    dueDate: dueDateOn(dueYear, dueMonth, dueDay),
  };
}
