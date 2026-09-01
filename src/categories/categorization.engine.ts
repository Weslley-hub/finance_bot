import { Injectable, Logger } from '@nestjs/common';
import { Category, CategorizationSource, TransactionType } from '@prisma/client';
import { AiService, AiCategoryGuess } from '../ai/ai.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { matchCategoryKeyword } from './match-category-keywords';
import { matchIncomeSlug } from './income';
import { parseMessage } from './message-parser';
import { matchRule } from './rule-matcher';
import { pickLearnedHistory } from './correction-learning';
import { normalizeText, stripNoiseWords } from './text-normalize';

type CategoryWithParent = Category & { parent: Category | null };

export type CategorizeInput = {
  text: string;
  familyId: string;
};

export type CategorizeResult = {
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  categoryId: string;
  categoryName: string;
  subcategory?: string;
  merchant?: string;
  source: CategorizationSource;
  confidence: number;
};

@Injectable()
export class CategorizationEngine {
  private readonly logger = new Logger(CategorizationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async categorize(input: CategorizeInput): Promise<CategorizeResult | null> {
    const parsed = parseMessage(input.text);
    if (parsed.kind !== 'movement') {
      return null;
    }

    const searchText = `${parsed.rest} ${input.text}`;
    const merchant = this.extractMerchant(parsed.rest);

    if (parsed.type === 'LOAN') {
      const loanCategory = await this.prisma.category.findUnique({
        where: { slug: 'emprestimos' },
        include: { parent: true },
      });
      if (loanCategory) {
        return this.toResult('LOAN', parsed.amount, loanCategory, {
          source: 'RULE',
          confidence: 0.9,
          merchant,
        });
      }
    }

    if (parsed.type === 'TRANSFER') {
      const outros = await this.prisma.category.findUnique({
        where: { slug: 'outros' },
        include: { parent: true },
      });
      if (outros) {
        return this.toResult('TRANSFER', parsed.amount, outros, {
          source: 'RULE',
          confidence: 0.92,
          merchant,
          description: merchant ?? 'Transferência',
        });
      }
    }

    if (parsed.type === 'INCOME') {
      const slug = matchIncomeSlug(searchText);
      const category = await this.prisma.category.findUnique({
        where: { slug },
        include: { parent: true },
      });
      if (category) {
        return this.toResult('INCOME', parsed.amount, category, {
          source: 'RULE',
          confidence: slug === 'outras-receitas' ? 0.7 : 0.93,
          merchant,
        });
      }
    }

    const rules = await this.prisma.categoryRule.findMany({
      where: {
        OR: [{ familyId: input.familyId }, { familyId: null }],
      },
      include: {
        category: { include: { parent: true } },
      },
    });

    const byFamily = matchRule(
      searchText,
      rules.filter((rule) => rule.familyId === input.familyId),
      input.familyId,
    );
    if (byFamily) {
      return this.toResult(parsed.type, parsed.amount, byFamily.category, {
        source: 'HISTORY',
        confidence: Math.max(byFamily.confidence, 0.96),
        merchant: byFamily.merchant ?? merchant,
      });
    }

    const byHistory = await this.matchHistory(input.familyId, merchant, searchText);
    if (byHistory) {
      return this.toResult(parsed.type, parsed.amount, byHistory, {
        source: 'HISTORY',
        confidence: 0.94,
        merchant,
      });
    }

    const byRule = matchRule(
      searchText,
      rules.filter((rule) => rule.familyId == null),
    );
    if (byRule) {
      return this.toResult(parsed.type, parsed.amount, byRule.category, {
        source: 'RULE',
        confidence: byRule.confidence,
        merchant: byRule.merchant ?? merchant,
      });
    }

    const byKeyword = await this.matchCatalogKeyword(searchText);
    if (byKeyword) {
      return this.toResult(parsed.type, parsed.amount, byKeyword, {
        source: 'RULE',
        confidence: 0.88,
        merchant,
      });
    }

    if (parsed.type === 'EXPENSE' || parsed.type === 'INCOME') {
      const byAi = await this.matchAi(input.text, parsed.amount, parsed.type);
      if (byAi) {
        const category = await this.prisma.category.findUnique({
          where: { slug: byAi.categorySlug },
          include: { parent: true },
        });

        if (category) {
          return this.toResult(byAi.type ?? parsed.type, parsed.amount, category, {
            source: 'AI',
            confidence: 0.7,
            merchant: byAi.merchant ?? merchant,
            description: byAi.description,
          });
        }
      }
    }

    const fallback = await this.prisma.category.findUnique({
      where: { slug: 'outros' },
      include: { parent: true },
    });

    if (!fallback) {
      this.logger.warn('Categoria "outros" não encontrada no catálogo.');
      return null;
    }

    return this.toResult(parsed.type, parsed.amount, fallback, {
      source: 'MANUAL',
      confidence: 0.2,
      merchant,
    });
  }

  private async matchCatalogKeyword(text: string) {
    const slug = matchCategoryKeyword(text);
    if (!slug) {
      return undefined;
    }

    return this.prisma.category.findUnique({
      where: { slug },
      include: { parent: true },
    });
  }

  private async matchHistory(
    familyId: string,
    merchant: string | undefined,
    text: string,
  ): Promise<CategoryWithParent | undefined> {
    const haystack = [merchant, text].filter(Boolean).join(' ');
    if (!stripNoiseWords(haystack)) {
      return undefined;
    }

    const previous = await this.prisma.transaction.findMany({
      where: {
        familyId,
        categorizationSource: { in: ['MANUAL', 'HISTORY'] },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        category: { include: { parent: true } },
        subcategory: { include: { parent: true } },
      },
    });

    const matched = pickLearnedHistory(
      haystack,
      previous.map((row) => ({
        merchant: row.merchant,
        description: row.description,
        rawText: row.rawText,
        categorizationSource: row.categorizationSource,
        categorySlug: (row.subcategory ?? row.category).slug,
        category: row.subcategory ?? row.category,
      })),
    );

    return matched?.category;
  }

  private async matchAi(
    text: string,
    amount: number,
    type: 'EXPENSE' | 'INCOME',
  ): Promise<AiCategoryGuess | null> {
    const categories = await this.prisma.category.findMany({
      select: { slug: true, name: true, emoji: true, parentId: true },
      orderBy: { sortOrder: 'asc' },
    });

    return this.ai.guessCategory({ text, amount, type, categories });
  }

  private extractMerchant(rest: string): string | undefined {
    const cleaned = stripNoiseWords(rest);
    return cleaned || undefined;
  }

  private toResult(
    type: TransactionType,
    amount: number,
    category: CategoryWithParent,
    extra: {
      source: CategorizationSource;
      confidence: number;
      merchant?: string;
      description?: string;
    },
  ): CategorizeResult {
    const parent = category.parent;
    const top = parent ?? category;
    const subcategory = parent ? category.name : undefined;
    const description =
      extra.description ??
      subcategory ??
      (category.slug === 'outros' || category.slug === 'renda-extra'
        ? extra.merchant
        : undefined) ??
      category.name;

    return {
      type,
      amount,
      description,
      category: normalizeText(top.name).replace(/\s+/g, '_'),
      categoryId: category.id,
      categoryName: `${top.emoji} ${top.name}`,
      subcategory,
      merchant: extra.merchant,
      source: extra.source,
      confidence: extra.confidence,
    };
  }
}
