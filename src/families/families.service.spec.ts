import { UnauthorizedException } from '@nestjs/common';
import { FamiliesService } from './families.service';

describe('FamiliesService', () => {
  function setup() {
    const prisma = {
      allowedTelegramChat: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      family: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const config = {
      get: jest.fn().mockReturnValue(''),
    };
    const service = new FamiliesService(prisma as never, config as never);
    return { service, prisma };
  }

  it('isChatAllowed consulta AllowedTelegramChat', async () => {
    const { service, prisma } = setup();
    prisma.allowedTelegramChat.findUnique.mockResolvedValue({
      chatId: '-1001',
    });

    await expect(service.isChatAllowed('-1001')).resolves.toBe(true);
    expect(prisma.allowedTelegramChat.findUnique).toHaveBeenCalledWith({
      where: { chatId: '-1001' },
    });
  });

  it('isChatAllowed recusa chat ausente da lista', async () => {
    const { service, prisma } = setup();
    prisma.allowedTelegramChat.findUnique.mockResolvedValue(null);

    await expect(service.isChatAllowed('-9')).resolves.toBe(false);
  });

  it('upsertFromChat lança UnauthorizedException se o chat não estiver autorizado', async () => {
    const { service, prisma } = setup();
    prisma.allowedTelegramChat.findUnique.mockResolvedValue(null);

    await expect(service.upsertFromChat('-9', 'Outro grupo')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.family.upsert).not.toHaveBeenCalled();
  });

  it('assertBoundChat recusa família sem telegramChatId', () => {
    const { service } = setup();
    expect(() =>
      service.assertBoundChat({ telegramChatId: null }, '-1001'),
    ).toThrow(UnauthorizedException);
  });
});
