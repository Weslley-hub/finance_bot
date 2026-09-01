import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type TelegramFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByTelegramId(telegramUserId: string) {
    return this.prisma.user.findUnique({
      where: { telegramUserId },
    });
  }

  upsertFromTelegram(from: TelegramFrom, familyId?: string) {
    const telegramUserId = String(from.id);
    const name =
      [from.first_name, from.last_name].filter(Boolean).join(' ') ||
      from.username ||
      telegramUserId;

    return this.prisma.user.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        name,
        username: from.username,
        familyId,
      },
      update: {
        name,
        username: from.username,
        ...(familyId ? { familyId } : {}),
      },
    });
  }

  joinFamily(telegramUserId: string, familyId: string) {
    return this.prisma.user.update({
      where: { telegramUserId },
      data: { familyId },
    });
  }
}
