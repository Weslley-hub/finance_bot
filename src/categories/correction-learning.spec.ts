import {
  historyMerchantMatches,
  learningMerchant,
  merchantToPattern,
  pickLearnedHistory,
} from './correction-learning';

describe('merchantToPattern', () => {
  it('gera AMAZON* a partir de Amazon', () => {
    expect(merchantToPattern('Amazon')).toBe('AMAZON*');
    expect(merchantToPattern('amazon.com.br')).toBe('AMAZON*');
  });

  it('ignora rótulos genéricos', () => {
    expect(merchantToPattern('Pagamento')).toBeNull();
  });
});

describe('learningMerchant', () => {
  it('usa o estabelecimento gravado', () => {
    expect(
      learningMerchant({
        merchant: 'Amazon',
        rawText: 'gastei 39,90 na amazon',
      }),
    ).toBe('Amazon');
  });

  it('cai no texto bruto quando não há estabelecimento', () => {
    expect(
      learningMerchant({
        merchant: null,
        rawText: 'gastei 39,90 na amazon',
      }),
    ).toBe('AMAZON');
  });
});

describe('pickLearnedHistory', () => {
  const educacao = {
    merchant: 'Amazon',
    description: 'Educação',
    rawText: 'gastei 39,90 na amazon',
    categorizationSource: 'MANUAL' as const,
    categorySlug: 'educacao',
  };

  const regraErrada = {
    merchant: 'Amazon',
    description: 'Outros',
    rawText: 'gastei 20 na amazon',
    categorizationSource: 'RULE' as const,
    categorySlug: 'outros',
  };

  it('reaproveita correção MANUAL em AMAZON curso', () => {
    expect(
      pickLearnedHistory('AMAZON CURSO', [educacao, regraErrada])?.categorySlug,
    ).toBe('educacao');
  });

  it('não copia o erro da regra global', () => {
    expect(pickLearnedHistory('AMAZON CURSO', [regraErrada])).toBeUndefined();
  });

  it('casa o estabelecimento como palavra inteira', () => {
    expect(historyMerchantMatches('GASTEI 80 AMAZON CURSO', educacao)).toBe(
      true,
    );
    expect(historyMerchantMatches('GASTEI 80 NO MERCADO', educacao)).toBe(
      false,
    );
  });
});
