export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;

  return Array.from({ length: count }, (_, index) => {
    const extra = index < remainder ? 1 : 0;
    return (base + extra) / 100;
  });
}

export function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
