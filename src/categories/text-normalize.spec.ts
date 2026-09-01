import { normalizeText, stripNoiseWords } from './text-normalize';

describe('normalizeText', () => {
  it('remove acentos e padroniza caixa', () => {
    expect(normalizeText('Mercadinho São José')).toBe('MERCADINHO SAO JOSE');
  });
});

describe('stripNoiseWords', () => {
  it('mantém o estabelecimento', () => {
    expect(stripNoiseWords('gastei  no posto')).toBe('POSTO');
  });
});
