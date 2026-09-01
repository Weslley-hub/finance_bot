import { matchRule, patternToRegex } from './rule-matcher';

describe('patternToRegex', () => {
  it('casa UBER* com Uber e variações', () => {
    const regex = patternToRegex('UBER*');
    expect(regex.test('UBER TRIP')).toBe(true);
    expect(regex.test('PAGAMENTO UBER')).toBe(true);
  });

  it('casa POSTO em gastei 76 no posto', () => {
    const regex = patternToRegex('POSTO*');
    expect(regex.test('GASTEI 76 NO POSTO')).toBe(true);
  });
});

describe('matchRule', () => {
  const rules = [
    { pattern: 'UBER*', familyId: null, confidence: 0.9, id: 'uber' },
    { pattern: 'UBER EATS*', familyId: null, confidence: 0.95, id: 'eats' },
    { pattern: 'MERCADINHO*', familyId: 'fam-1', confidence: 0.99, id: 'local' },
    { pattern: 'MERCADINHO*', familyId: null, confidence: 0.9, id: 'global' },
  ];

  it('prefere o padrão mais específico', () => {
    expect(matchRule('UBER EATS CENTRO', rules)?.id).toBe('eats');
  });

  it('prefere regra da família', () => {
    expect(matchRule('PIX MERCADINHO SAO JOSE', rules, 'fam-1')?.id).toBe(
      'local',
    );
  });

  it('prefere AMAZON da família sobre a regra global', () => {
    const amazonRules = [
      { pattern: 'AMAZON*', familyId: null, confidence: 0.9, id: 'global' },
      { pattern: 'AMAZON*', familyId: 'fam-1', confidence: 0.97, id: 'learned' },
    ];
    expect(matchRule('AMAZON CURSO', amazonRules, 'fam-1')?.id).toBe('learned');
  });
});
