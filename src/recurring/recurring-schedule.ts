export function dueDateOn(
  year: number,
  month: number,
  dayOfMonth: number,
): Date {
  const monthIndex = month - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

export function isDueOnOrAfterToday(due: Date, today = new Date()): boolean {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay >= start;
}

export function nextDueOccurrence(
  dayOfMonth: number,
  from = new Date(),
): { year: number; month: number; dueDate: Date } {
  const year = from.getFullYear();
  const month = from.getMonth() + 1;
  const dueThisMonth = dueDateOn(year, month, dayOfMonth);
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (dueThisMonth >= fromDay) {
    return { year, month, dueDate: dueThisMonth };
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    year: nextYear,
    month: nextMonth,
    dueDate: dueDateOn(nextYear, nextMonth, dayOfMonth),
  };
}
