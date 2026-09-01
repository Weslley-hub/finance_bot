import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionPermission, User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  assertFamilyBoundToChat,
  parseAllowedChatIds,
} from '../common/security/authorized-chat';

@Injectable()
export class FamiliesService implements OnModuleInit {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncAllowedChats();
  }

  findByChatId(telegramChatId: string) {
    return this.prisma.family.findUnique({
      where: { telegramChatId },
      include: { users: true },
    });
  }

  async upsertFromChat(telegramChatId: string, name: string) {
    if (!(await this.isChatAllowed(telegramChatId))) {
      throw new UnauthorizedException();
    }

    const family = await this.prisma.family.upsert({
      where: { telegramChatId },
      create: { telegramChatId, name },
      update: { name },
      include: { users: true },
    });

    await this.prisma.allowedTelegramChat.upsert({
      where: { chatId: telegramChatId },
      create: { chatId: telegramChatId, label: name, familyId: family.id },
      update: { label: name, familyId: family.id },
    });

    return family;
  }

  setPermission(familyId: string, permission: TransactionPermission) {
    return this.prisma.family.update({
      where: { id: familyId },
      data: { transactionPermission: permission },
      include: { users: true },
    });
  }

  listMembers(familyId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
    });
  }

  async isChatAllowed(chatId: string): Promise<boolean> {
    const allowed = await this.prisma.allowedTelegramChat.findUnique({
      where: { chatId },
    });
    return Boolean(allowed);
  }

  assertBoundChat(
    family: { telegramChatId: string | null } | null,
    chatId: string,
  ): void {
    assertFamilyBoundToChat(family, chatId);
  }

  private async syncAllowedChats(): Promise<void> {
    const fromEnv = parseAllowedChatIds(
      this.config.get<string>('ALLOWED_TELEGRAM_CHAT_IDS'),
    );

    for (const chatId of fromEnv) {
      await this.prisma.allowedTelegramChat.upsert({
        where: { chatId },
        create: { chatId },
        update: {},
      });
    }

    const families = await this.prisma.family.findMany({
      select: { id: true, telegramChatId: true, name: true },
    });

    for (const family of families) {
      if (!family.telegramChatId) {
        continue;
      }

      await this.prisma.allowedTelegramChat.upsert({
        where: { chatId: family.telegramChatId },
        create: {
          chatId: family.telegramChatId,
          label: family.name,
          familyId: family.id,
        },
        update: { familyId: family.id, label: family.name },
      });
    }

    this.logger.log('Lista de chats autorizados sincronizada');
  }
}
