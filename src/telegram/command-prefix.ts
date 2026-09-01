export function stripCommandPrefix(text: string, names: string[]): string {
  const ordered = [...names].sort((a, b) => b.length - a.length);
  const escaped = ordered.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const pattern = new RegExp(
    `^/(?:${escaped.join('|')})(?=@\\S+|\\s|$)(?:@\\S+)?\\s*`,
    'i',
  );
  return text.replace(pattern, '').trim();
}

export function parseSlashCommand(
  text: string,
): { name: string; args: string } | null {
  const match = text
    .trim()
    .match(/^\/([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
  if (!match?.[1]) {
    return null;
  }

  const name = match[1]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return { name, args: (match[2] ?? '').trim() };
}
