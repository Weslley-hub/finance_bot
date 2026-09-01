import { buildInstallmentCard } from './installment-card';

describe('buildInstallmentCard', () => {
  it('mostra compra, parcelas e cartão', () => {
    const card = buildInstallmentCard({
      description: 'TV',
      totalAmount: 2400,
      installmentCount: 10,
      installmentAmount: 240,
      cardName: 'Nubank',
    });

    expect(card).toContain('💳 Parcelamento registrado');
    expect(card).toContain('Compra:');
    expect(card).toContain('Parcelamento:');
    expect(card).toContain('10x');
    expect(card).toContain('Cartão:');
    expect(card).toContain('Nubank');
    expect(card).toContain('1/10 neste mês');
    expect(card).toContain('9 parcelas futuras');
  });
});
