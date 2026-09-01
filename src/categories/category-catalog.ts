export type CategorySeed = {
  slug: string;
  name: string;
  emoji: string;
  aliases?: string[];
  children?: CategorySeed[];
};

export type RuleSeed = {
  pattern: string;
  merchant: string;
  categorySlug: string;
  confidence?: number;
};

export const CATEGORY_CATALOG: CategorySeed[] = [
  { slug: 'moradia', name: 'Moradia', emoji: '🏠' },
  {
    slug: 'alimentacao',
    name: 'Alimentação',
    emoji: '🍔',
    aliases: ['comida', 'refeicao'],
    children: [
      { slug: 'almoco', name: 'Almoço', emoji: '🥗', aliases: ['almoco'] },
      { slug: 'jantar', name: 'Jantar', emoji: '🍽️' },
      { slug: 'restaurante', name: 'Restaurante', emoji: '🍽️' },
            { slug: 'delivery', name: 'Delivery', emoji: '🛵', aliases: ['ifood', 'rappi'] },
      { slug: 'lanche', name: 'Lanche', emoji: '🥪' },
      { slug: 'cafe', name: 'Café', emoji: '☕' },
    ],
  },
  { slug: 'mercado', name: 'Mercado', emoji: '🛒' },
  {
    slug: 'transporte',
    name: 'Transporte',
    emoji: '🚗',
    children: [
      {
        slug: 'combustivel',
        name: 'Combustível',
        emoji: '⛽',
        aliases: ['gasolina', 'etanol', 'alcool', 'diesel', 'gnv'],
      },
      { slug: 'uber', name: 'Uber', emoji: '🚕' },
      { slug: 'manutencao', name: 'Manutenção', emoji: '🔧' },
      { slug: 'estacionamento', name: 'Estacionamento', emoji: '🅿️' },
    ],
  },
  { slug: 'energia', name: 'Energia', emoji: '💡', aliases: ['luz', 'enel', 'cemig', 'copel', 'cpfl', 'light', 'energisa'] },
  { slug: 'agua', name: 'Água', emoji: '💧', aliases: ['sabesp', 'cedae', 'sanepar'] },
  { slug: 'internet', name: 'Internet', emoji: '🌐', aliases: ['vivo', 'claro', 'net', 'virtua'] },
  { slug: 'telefonia', name: 'Telefonia', emoji: '📱' },
  { slug: 'cartao', name: 'Cartão', emoji: '💳' },
  { slug: 'saude', name: 'Saúde', emoji: '🏥', aliases: ['academia'] },
  { slug: 'farmacia', name: 'Farmácia', emoji: '💊' },
  {
    slug: 'educacao',
    name: 'Educação',
    emoji: '🎓',
    aliases: ['curso', 'faculdade', 'escola', 'udemy', 'alura'],
  },
  { slug: 'lazer', name: 'Lazer', emoji: '🎮' },
  { slug: 'roupas', name: 'Roupas', emoji: '👕', aliases: ['tenis', 'sapato', 'calca', 'camisa', 'roupa'] },
  { slug: 'pets', name: 'Pets', emoji: '🐶' },
  { slug: 'presentes', name: 'Presentes', emoji: '🎁' },
  { slug: 'viagem', name: 'Viagem', emoji: '✈️' },
  { slug: 'investimentos', name: 'Investimentos', emoji: '💰' },
  { slug: 'emprestimos', name: 'Empréstimos', emoji: '🏦' },
  { slug: 'assinaturas', name: 'Assinaturas', emoji: '📺', aliases: ['netflix', 'spotify'] },
  { slug: 'trabalho', name: 'Trabalho', emoji: '💼' },
  {
    slug: 'salario',
    name: 'Salário',
    emoji: '💵',
    aliases: ['holerite', 'decimo terceiro', '13 salario'],
  },
  {
    slug: 'renda-extra',
    name: 'Renda extra',
    emoji: '💸',
    aliases: ['freelance', 'extra', 'bico'],
  },
  {
    slug: 'reembolso',
    name: 'Reembolso',
    emoji: '↩️',
    aliases: ['estorno', 'devolucao', 'refund'],
  },
  {
    slug: 'rendimento',
    name: 'Rendimento',
    emoji: '📈',
    aliases: ['dividendos', 'dividendo', 'juros'],
  },
  {
    slug: 'outras-receitas',
    name: 'Outras receitas',
    emoji: '💵',
  },
  { slug: 'outros', name: 'Outros', emoji: '📦' },
];

export const DEFAULT_CATEGORY_RULES: RuleSeed[] = [
  { pattern: 'UBER EATS*', merchant: 'Uber Eats', categorySlug: 'delivery' },
  { pattern: 'UBER*', merchant: 'Uber', categorySlug: 'uber' },
  { pattern: 'POSTO SHELL*', merchant: 'Posto Shell', categorySlug: 'combustivel' },
  { pattern: 'POSTO*', merchant: 'Posto', categorySlug: 'combustivel' },
  { pattern: 'SHELL*', merchant: 'Shell', categorySlug: 'combustivel' },
  { pattern: 'IPIRANGA*', merchant: 'Ipiranga', categorySlug: 'combustivel' },
  { pattern: 'GASOLINA*', merchant: 'Gasolina', categorySlug: 'combustivel' },
  { pattern: 'ETANOL*', merchant: 'Etanol', categorySlug: 'combustivel' },
  { pattern: 'DIESEL*', merchant: 'Diesel', categorySlug: 'combustivel' },
  { pattern: 'COMBUSTIVEL*', merchant: 'Combustível', categorySlug: 'combustivel' },
  { pattern: 'ALIMENTACAO*', merchant: 'Alimentação', categorySlug: 'alimentacao' },
  { pattern: 'COMIDA*', merchant: 'Comida', categorySlug: 'alimentacao' },
  { pattern: 'NETFLIX*', merchant: 'Netflix', categorySlug: 'assinaturas' },
  { pattern: 'SPOTIFY*', merchant: 'Spotify', categorySlug: 'assinaturas' },
  { pattern: 'SUPERMERCADO*', merchant: 'Supermercado', categorySlug: 'mercado' },
  { pattern: 'MERCADINHO*', merchant: 'Mercadinho', categorySlug: 'mercado' },
  { pattern: 'CARREFOUR*', merchant: 'Carrefour', categorySlug: 'mercado' },
  { pattern: 'ATACADAO*', merchant: 'Atacadão', categorySlug: 'mercado' },
  { pattern: 'IFOOD*', merchant: 'iFood', categorySlug: 'delivery' },
  { pattern: 'RAPPI*', merchant: 'Rappi', categorySlug: 'delivery' },
  { pattern: 'FARMACIA*', merchant: 'Farmácia', categorySlug: 'farmacia' },
  { pattern: 'DROGARIA*', merchant: 'Drogaria', categorySlug: 'farmacia' },
  { pattern: 'AMAZON*', merchant: 'Amazon', categorySlug: 'outros' },
  { pattern: 'MERCADO*', merchant: 'Mercado', categorySlug: 'mercado' },
  { pattern: 'ALMOCO*', merchant: 'Almoço', categorySlug: 'almoco' },
  { pattern: 'ENEL*', merchant: 'Enel', categorySlug: 'energia' },
  { pattern: 'CEMIG*', merchant: 'Cemig', categorySlug: 'energia' },
];
