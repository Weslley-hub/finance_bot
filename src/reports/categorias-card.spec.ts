import { buildCategoriasCard, withPercents } from './categorias-card';

describe('withPercents', () => {
  it('ordena por valor e calcula participação', () => {
    const rows = withPercents([
      { emoji: '🍔', name: 'Alimentação', amount: 870 },
      { emoji: '🛒', name: 'Mercado', amount: 1423 },
      { emoji: '🏠', name: 'Moradia', amount: 1200 },
    ]);

    expect(rows[0]).toMatchObject({ name: 'Mercado', percent: 41 });
    expect(rows[1].name).toBe('Moradia');
    expect(rows[2].name).toBe('Alimentação');
  });
});

describe('buildCategoriasCard', () => {
  it('formata emoji, valor e percentual', () => {
    const card = buildCategoriasCard([
      { emoji: '🛒', name: 'Mercado', amount: 1423, percent: 23 },
      { emoji: '🏠', name: 'Moradia', amount: 1200, percent: 19 },
    ]);

    expect(card).toContain('🛒 Mercado');
    expect(card).toContain('23%');
    expect(card).toContain('🏠 Moradia');
    expect(card).toContain('19%');
  });

  it('avisa quando não há despesas', () => {
    expect(buildCategoriasCard([])).toBe('Nenhuma despesa neste mês.');
  });
});
