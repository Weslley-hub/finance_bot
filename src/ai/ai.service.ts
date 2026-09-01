import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CATEGORY_CATALOG, CategorySeed } from '../categories/category-catalog';
import {
  ParsedQuery,
  normalizeFinanceQuery,
} from '../categories/finance-query';
import { isSecretConfigured } from '../common/config/env.validation';
import {
  DocumentExtraction,
  parseDocumentExtraction,
} from '../documents/document-extraction';

export type AiCategoryGuess = {
  type?: 'EXPENSE' | 'INCOME';
  description: string;
  categorySlug: string;
  merchant?: string;
};

type GuessInput = {
  text: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  categories: Array<{ slug: string; name: string; emoji: string; parentId: string | null }>;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client?: OpenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (isSecretConfigured(apiKey)) {
      this.client = new OpenAI({ apiKey });
      return;
    }

    this.logger.warn(
      'OPENAI_API_KEY não configurado. Os serviços de IA ficam desativados.',
    );
  }

  isEnabled(): boolean {
    return Boolean(this.client);
  }

  async guessCategory(input: GuessInput): Promise<AiCategoryGuess | null> {
    if (!this.client) {
      return null;
    }

    const catalog = input.categories
      .map((category) => `${category.emoji} ${category.name} (${category.slug})`)
      .join('\n');

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você classifica transações financeiras em português. Responda só JSON com type (EXPENSE ou INCOME), description, categorySlug (exatamente um slug da lista) e merchant opcional.',
          },
          {
            role: 'user',
            content: [
              `Tipo sugerido: ${input.type}`,
              `Valor: ${input.amount}`,
              `Mensagem: ${input.text}`,
              '',
              'Categorias:',
              catalog,
            ].join('\n'),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as AiCategoryGuess;
      if (!parsed.categorySlug) {
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.warn(
        `Falha ao categorizar com IA: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async analyzeDocumentImage(
    imageBase64: string,
    mimeType = 'image/jpeg',
    caption?: string,
  ): Promise<DocumentExtraction | null> {
    if (!this.client) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: DOCUMENT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: caption
                  ? `Legenda do usuário: ${caption}`
                  : 'Analise este documento financeiro.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      });

      return this.parseAiJson(completion.choices[0]?.message?.content);
    } catch (error) {
      this.logger.warn(
        `Falha ao ler documento: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async analyzeDocumentText(
    text: string,
    caption?: string,
  ): Promise<DocumentExtraction | null> {
    if (!this.client) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: DOCUMENT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              caption ? `Legenda do usuário: ${caption}` : null,
              'Texto extraído do documento:',
              text.slice(0, 12000),
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
      });

      return this.parseAiJson(completion.choices[0]?.message?.content);
    } catch (error) {
      this.logger.warn(
        `Falha ao ler texto do documento: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private parseAiJson(raw?: string | null): DocumentExtraction | null {
    if (!raw) {
      return null;
    }

    return parseDocumentExtraction(JSON.parse(raw));
  }

  async interpretFinanceQuestion(text: string): Promise<ParsedQuery | null> {
    if (!this.client) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: FINANCE_QUERY_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `Pergunta: ${text}`,
              '',
              'Slugs de categoria:',
              catalogSlugs().join(', '),
            ].join('\n'),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return null;
      }

      return normalizeFinanceQuery(JSON.parse(raw));
    } catch (error) {
      this.logger.warn(
        `Falha ao interpretar pergunta: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

const DOCUMENT_SYSTEM_PROMPT = [
  'Você lê comprovantes, faturas e contas brasileiras.',
  'Responda só JSON com:',
  'kind (RECEIPT, BANK_RECEIPT, BILL, INVOICE, BANK_STATEMENT ou UNKNOWN),',
  'amount (número),',
  'date (DD/MM/AAAA do pagamento),',
  'dueDate (DD/MM/AAAA do vencimento),',
  'paymentType (PIX, TED, BOLETO, CARD, TRANSFER ou PAYMENT),',
  'movementType (EXPENSE, TRANSFER ou INCOME),',
  'originBank, destinationBank, destination, supplier, bank, barcode, description.',
  'Conta de luz, água, internet ou telefone com vencimento é BILL.',
  'Fatura de cartão de crédito (Nubank, Itaú...) é INVOICE.',
  'Extrato de conta corrente/poupança é BANK_STATEMENT.',
  'Comprovante de PIX, TED ou transferência entre bancos é BANK_RECEIPT.',
  'Cupom fiscal, comprovante de cartão ou pagamento a comércio é RECEIPT.',
  'Se o dinheiro saiu de um banco e entrou em outro banco da mesma pessoa (ex.: Nubank → Inter), movementType é TRANSFER, não EXPENSE.',
  'TRANSFER não é despesa: evita contar o mesmo dinheiro duas vezes.',
  'PIX/TED/pagamento para comércio, concessionária ou pessoa (Enel, mercado, João) é EXPENSE.',
  'Crédito recebido (depósito, PIX recebido) é INCOME.',
].join(' ');

const FINANCE_QUERY_SYSTEM_PROMPT = [
  'Você interpreta perguntas financeiras em português e responde só JSON.',
  'Campos: intent, person, categorySlug (opcional), months.',
  'intent: total, by_category, top_categories, top_expenses ou compare.',
  'person: me (quem pergunta), spouse (esposa/esposo/marido/mulher), named (primeiro nome de um membro) ou family (nós/a gente).',
  'Se person for named, inclua memberHint com o nome.',
  'months: 1 para este mês; 3 para os últimos três meses.',
  'compare = gasto deste mês vs mês passado.',
  'top_categories = onde mais gastam (agrupado por categoria).',
  'top_expenses = maiores lançamentos individuais.',
  'by_category exige categorySlug exatamente da lista.',
  'Não invente valores: só estruture a consulta para o banco.',
].join(' ');

function catalogSlugs(catalog: CategorySeed[] = CATEGORY_CATALOG): string[] {
  const slugs: string[] = [];

  const walk = (items: CategorySeed[]) => {
    for (const item of items) {
      slugs.push(item.slug);
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };

  walk(catalog);
  return slugs;
}
