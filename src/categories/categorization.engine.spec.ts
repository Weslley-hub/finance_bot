import { CategorizationEngine } from './categorization.engine';

const educacao = {
  id: 'cat-edu',
  slug: 'educacao',
  name: 'Educação',
  emoji: '🎓',
  parentId: null,
  parent: null,
};

const outros = {
  id: 'cat-outros',
  slug: 'outros',
  name: 'Outros',
  emoji: '📦',
  parentId: null,
  parent: null,
};

describe('CategorizationEngine — aprendizado', () => {
  function setup(rules: unknown[], history: unknown[] = []) {
    const prisma = {
      categoryRule: {
        findMany: jest.fn().mockResolvedValue(rules),
      },
      category: {
        findUnique: jest.fn(),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue(history),
      },
    };
    const ai = { guessCategory: jest.fn().mockResolvedValue(null) };
    const engine = new CategorizationEngine(prisma as never, ai as never);
    return { engine, prisma };
  }

  it('usa a correção da família em AMAZON curso, não a regra global', async () => {
    const { engine, prisma } = setup([
      {
        pattern: 'AMAZON*',
        familyId: null,
        merchant: 'Amazon',
        confidence: 0.9,
        category: outros,
      },
      {
        pattern: 'AMAZON*',
        familyId: 'fam-1',
        merchant: 'Amazon',
        confidence: 0.97,
        category: educacao,
      },
    ]);

    const result = await engine.categorize({
      text: 'gastei 80 amazon curso',
      familyId: 'fam-1',
    });

    expect(result).toMatchObject({
      source: 'HISTORY',
      categoryId: 'cat-edu',
    });
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('reaproveita histórico MANUAL quando ainda não há regra da família', async () => {
    const { engine } = setup(
      [
        {
          pattern: 'AMAZON*',
          familyId: null,
          merchant: 'Amazon',
          confidence: 0.9,
          category: outros,
        },
      ],
      [
        {
          merchant: 'Amazon',
          description: 'Educação',
          rawText: 'gastei 39,90 na amazon',
          categorizationSource: 'MANUAL',
          category: educacao,
          subcategory: null,
        },
      ],
    );

    const result = await engine.categorize({
      text: 'gastei 80 na amazon curso',
      familyId: 'fam-1',
    });

    expect(result).toMatchObject({
      source: 'HISTORY',
      categoryId: 'cat-edu',
    });
  });
});
