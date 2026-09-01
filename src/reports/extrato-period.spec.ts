import { parseExtratoRange } from './extrato-period';

describe('parseExtratoRange', () => {
  const at = new Date(2026, 7, 31);

  it('usa o mês atual sem filtro', () => {
    const range = parseExtratoRange('', at);
    expect(range?.from).toEqual(new Date(2026, 7, 1));
    expect(range?.to).toEqual(new Date(2026, 8, 1));
    expect(range?.label).toBe('agosto');
  });

  it('filtra hoje', () => {
    const range = parseExtratoRange('hoje', at);
    expect(range?.from).toEqual(new Date(2026, 7, 31));
    expect(range?.to).toEqual(new Date(2026, 8, 1));
  });

  it('filtra a semana (segunda a domingo)', () => {
    const range = parseExtratoRange('semana', at);
    expect(range?.from).toEqual(new Date(2026, 7, 31));
    expect(range?.to).toEqual(new Date(2026, 8, 7));
  });

  it('filtra pelo nome do mês', () => {
    const range = parseExtratoRange('agosto', at);
    expect(range?.from).toEqual(new Date(2026, 7, 1));
    expect(range?.to).toEqual(new Date(2026, 8, 1));
  });

  it('rejeita período desconhecido', () => {
    expect(parseExtratoRange('xyz', at)).toBeNull();
  });
});
