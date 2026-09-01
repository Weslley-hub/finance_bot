export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9*\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripNoiseWords(value: string): string {
  return normalizeText(value)
    .replace(
      /\b(GASTEI|GASTO|GASTOS|PAGUEI|RECEBI|RECEBEU|GANHEI|GANHOU|ENTROU|COM|NO|NA|NOS|NAS|EM|DO|DA|DOS|DAS|DE|UM|UMA|REAIS|REAL|PIX|R|MEU|MINHA)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
