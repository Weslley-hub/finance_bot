import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CATEGORY_CATALOG, DEFAULT_CATEGORY_RULES } from './category-catalog';
import { learningMerchant, merchantToPattern } from './correction-learning';

type CategoryWithChildren = Category & { children: Category[] };

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedCatalog();
  }

  async seedCatalog(): Promise<void> {
    let sortOrder = 0;

    for (const item of CATEGORY_CATALOG) {
      const parent = await this.upsertCategory(item.slug, item.name, item.emoji, null, sortOrder);
      sortOrder += 1;

      for (const child of item.children ?? []) {
        await this.upsertCategory(
          child.slug,
          child.name,
          child.emoji,
          parent.id,
          sortOrder,
        );
        sortOrder += 1;
      }
    }

    const categories = await this.prisma.category.findMany();
    const bySlug = new Map(categories.map((category) => [category.slug, category]));

    for (const rule of DEFAULT_CATEGORY_RULES) {
      const category = bySlug.get(rule.categorySlug);
      if (!category) {
        this.logger.warn(`Regra ${rule.pattern} aponta para categoria inexistente ${rule.categorySlug}`);
        continue;
      }

      const existing = await this.prisma.categoryRule.findFirst({
        where: {
          familyId: null,
          pattern: rule.pattern,
          categoryId: category.id,
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.categoryRule.create({
        data: {
          familyId: null,
          pattern: rule.pattern,
          merchant: rule.merchant,
          categoryId: category.id,
          confidence: rule.confidence ?? 0.9,
        },
      });
    }

    this.logger.log('Catálogo de categorias e regras padrão sincronizado');
  }

  async listTree(): Promise<CategoryWithChildren[]> {
    const roots = await this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    return roots;
  }

  formatTree(tree: CategoryWithChildren[]): string {
    return tree
      .map((root) => {
        const header = `${root.emoji} ${root.name}`;
        if (root.children.length === 0) {
          return header;
        }

        const lines = root.children.map((child, index) => {
          const prefix = index === root.children.length - 1 ? '└──' : '├──';
          return `${prefix} ${child.name}`;
        });

        return [header, ...lines].join('\n');
      })
      .join('\n\n');
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: { parent: true, children: true },
    });
  }

  async rememberCorrection(input: {
    familyId: string;
    categoryId: string;
    merchant?: string | null;
    rawText?: string | null;
    description?: string | null;
  }): Promise<{ pattern: string; label: string } | null> {
    const label = learningMerchant(input);
    if (!label) {
      return null;
    }

    const pattern = merchantToPattern(label);
    if (!pattern) {
      return null;
    }

    const existing = await this.prisma.categoryRule.findFirst({
      where: { familyId: input.familyId, pattern },
    });

    if (existing) {
      await this.prisma.categoryRule.update({
        where: { id: existing.id },
        data: {
          categoryId: input.categoryId,
          merchant: label,
          confidence: 0.97,
        },
      });
    } else {
      await this.prisma.categoryRule.create({
        data: {
          familyId: input.familyId,
          pattern,
          merchant: label,
          categoryId: input.categoryId,
          confidence: 0.97,
        },
      });
    }

    return { pattern, label };
  }

  categorySubtreeIds(category: {
    id: string;
    children?: Array<{ id: string }>;
  }): string[] {
    return [category.id, ...(category.children ?? []).map((child) => child.id)];
  }

  private upsertCategory(
    slug: string,
    name: string,
    emoji: string,
    parentId: string | null,
    sortOrder: number,
  ) {
    return this.prisma.category.upsert({
      where: { slug },
      create: { slug, name, emoji, parentId, sortOrder },
      update: { name, emoji, parentId, sortOrder },
    });
  }
}
