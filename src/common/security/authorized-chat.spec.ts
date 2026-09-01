import { UnauthorizedException } from '@nestjs/common';
import {
  assertFamilyBoundToChat,
  parseAllowedChatIds,
  unauthorizedChatMessage,
} from './authorized-chat';

describe('parseAllowedChatIds', () => {
  it('lê ids separados por vírgula', () => {
    expect(parseAllowedChatIds('-1001, -1002 ; 123')).toEqual([
      '-1001',
      '-1002',
      '123',
    ]);
  });

  it('ignora placeholder', () => {
    expect(parseAllowedChatIds('CHANGE_ME')).toEqual([]);
  });
});

describe('assertFamilyBoundToChat', () => {
  it('rejeita família sem telegramChatId', () => {
    expect(() =>
      assertFamilyBoundToChat({ telegramChatId: null }, '-1001'),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita chat diferente do vinculado', () => {
    expect(() =>
      assertFamilyBoundToChat({ telegramChatId: '-1001' }, '-1002'),
    ).toThrow(UnauthorizedException);
  });

  it('aceita o grupo vinculado', () => {
    expect(() =>
      assertFamilyBoundToChat({ telegramChatId: '-1001' }, '-1001'),
    ).not.toThrow();
  });
});

describe('unauthorizedChatMessage', () => {
  it('explica que o grupo não está na lista', () => {
    expect(unauthorizedChatMessage('-100123')).toContain('-100123');
    expect(unauthorizedChatMessage('-100123')).toContain('não está autorizado');
  });
});
