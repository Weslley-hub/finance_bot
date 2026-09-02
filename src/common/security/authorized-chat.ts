import { UnauthorizedException } from '@nestjs/common';

export function parseAllowedChatIds(raw?: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== 'CHANGE_ME');
}

export function assertFamilyBoundToChat(
  family: { telegramChatId: string | null } | null,
  chatId: string,
): void {
  if (!family?.telegramChatId) {
    throw new UnauthorizedException();
  }

  if (family.telegramChatId !== chatId) {
    throw new UnauthorizedException();
  }
}

export function unauthorizedChatMessage(chatId: string): string {
  return [
    'Este grupo não está autorizado.',
    `Id do grupo: ${chatId}`,
    'Envie esse ID do grupo para @weslleyteixeir4 e peça a liberação do grupo.',
  ].join('\n');
}
