import { parseSlashCommand, stripCommandPrefix } from './command-prefix';

describe('stripCommandPrefix', () => {
  const names = ['cartao', 'cartoes', 'cartão', 'cartões'];

  it('trata /cartoes como lista (sem leftover es)', () => {
    expect(stripCommandPrefix('/cartoes', names)).toBe('');
    expect(stripCommandPrefix('/cartoes@finance_house_bot', names)).toBe('');
  });

  it('trata /metas como lista (não deixa s solto)', () => {
    expect(stripCommandPrefix('/metas', ['meta', 'metas'])).toBe('');
    expect(stripCommandPrefix('/meta 2000', ['meta', 'metas'])).toBe('2000');
  });

  it('não corta /recorrencias no meio de /recorrentes', () => {
    const names = ['recorrencias', 'recorrencia', 'recorrentes', 'recorrente'];
    expect(stripCommandPrefix('/recorrentes', names)).toBe('');
    expect(stripCommandPrefix('/recorrencias', names)).toBe('');
    expect(stripCommandPrefix('/recorrente Terreno 289 dia 10', names)).toBe(
      'Terreno 289 dia 10',
    );
  });

  it('mantém os argumentos de /cartao', () => {
    expect(
      stripCommandPrefix(
        '/cartao Santander limite 18000 fecha dia 4 vence dia 10',
        names,
      ),
    ).toBe('Santander limite 18000 fecha dia 4 vence dia 10');
  });

  it('aceita /cartão com acento', () => {
    expect(
      stripCommandPrefix(
        '/cartão Santander limite 18000 fecha dia 4 vence dia 10',
        names,
      ),
    ).toBe('Santander limite 18000 fecha dia 4 vence dia 10');
  });
});

describe('parseSlashCommand', () => {
  it('lê /recorrentes e /recorrências', () => {
    expect(parseSlashCommand('/recorrentes')).toEqual({
      name: 'recorrentes',
      args: '',
    });
    expect(parseSlashCommand('/recorrências@finance_house_bot')).toEqual({
      name: 'recorrencias',
      args: '',
    });
  });

  it('lê /metas sem argumentos', () => {
    expect(parseSlashCommand('/metas')).toEqual({ name: 'metas', args: '' });
  });

  it('normaliza acento em /cartão', () => {
    expect(parseSlashCommand('/cartão Santander limite 1')).toEqual({
      name: 'cartao',
      args: 'Santander limite 1',
    });
  });
});
