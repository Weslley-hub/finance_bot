import { Injectable, Logger } from '@nestjs/common';
import { Family, TransactionPermission, TransactionType, User, TransactionSource } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Context } from 'telegraf';
import { AiService } from '../ai/ai.service';
import { BillsService } from '../bills/bills.service';
import { BudgetsService } from '../budgets/budgets.service';
import {
  buildBudgetWarningCard,
  buildOrcamentoCard,
} from '../budgets/orcamento-card';
import { GoalsService } from '../goals/goals.service';
import { buildMetaCard } from '../goals/meta-card';
import { CardsService } from '../cards/cards.service';
import { buildCartaoCard, buildCartoesList, buildLimitesCard } from '../cards/cartao-card';
import { CategorizationEngine } from '../categories/categorization.engine';
import { CategoriesService } from '../categories/categories.service';
import { matchCategoryKeyword } from '../categories/match-category-keywords';
import {
  isAmbiguousTransfer,
  parseMessage,
  ParsedBillPayment,
  ParsedCorrection,
  ParsedRecurringBill,
  ParsedInstallment,
  ParsedBudget,
  parseBudget,
  parseGoal,
  parseCard,
  parseCardDelete,
  parseCardUsed,
  parseRecurringBillFromCommand,
  ParsedCard,
  ParsedSearch,
} from '../categories/message-parser';
import {
  looksLikeFinanceQuestion,
  ParsedQuery,
  queryDateRange,
} from '../categories/finance-query';
import { resolveQueryMember } from '../categories/query-person';
import { unauthorizedChatMessage } from '../common/security/authorized-chat';
import { monthName } from '../documents/document-extraction';
import { parseSlashCommand, stripCommandPrefix } from './command-prefix';
import { ReportsService } from '../reports/reports.service';
import { buildPrevisaoCard } from '../reports/previsao-card';
import { buildResumoCard } from '../reports/resumo-card';
import { buildCategoriasCard } from '../reports/categorias-card';
import { buildExtratoCard } from '../reports/extrato-card';
import { parseExtratoRange } from '../reports/extrato-period';
import { buildPayableCard } from '../reports/payable-card';
import {
  buildCompareAnswer,
  buildSpendAnswer,
  buildTopCategoriesAnswer,
  buildTopExpensesAnswer,
} from '../reports/finance-answers';
import { RecurringService } from '../recurring/recurring.service';
import { InstallmentsService } from '../installments/installments.service';
import { countInvoiceItems } from '../documents/card-invoice';
import { DocumentsService, IngestResult } from '../documents/documents.service';
import { FamiliesService } from '../families/families.service';
import { DuplicateHit } from '../transactions/duplicate';
import { TransactionsService, TransactionWithCard, CreateTransactionInput } from '../transactions/transactions.service';
import { effectiveCategoryId } from '../transactions/transaction-category';
import { UsersService } from '../users/users.service';
import { buildContasCard, ContasBill } from './contas-card';
import { buildInstallmentCard } from './installment-card';
import {
  billKeyboard,
  buildBillPreview,
  buildReceiptPreview,
  receiptKeyboard,
} from './document-cards';
import {
  buildDuplicateCard,
  duplicateKeyboard,
} from './duplicate-card';
import {
  buildInvoiceImportCard,
  buildInvoicePreviewCard,
  buildInvoiceReviewCard,
  invoiceKeyboard,
} from './invoice-card';
import {
  buildMovementCard,
  formatMoney,
  movementKeyboard,
  pendingKeyboard,
} from './movement-card';
import {
  PendingBillDraft,
  PendingDraft,
  PendingDuplicateDraft,
  PendingInvoiceDraft,
  PendingMovementsStore,
  PendingReceiptDraft,
} from './pending-movements.store';

type FamilyWithUsers = Family & { users: User[] };

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly families: FamiliesService,
    private readonly users: UsersService,
    private readonly categories: CategoriesService,
    private readonly engine: CategorizationEngine,
    private readonly transactions: TransactionsService,
    private readonly pending: PendingMovementsStore,
    private readonly ai: AiService,
    private readonly documents: DocumentsService,
    private readonly bills: BillsService,
    private readonly recurring: RecurringService,
    private readonly installments: InstallmentsService,
    private readonly reports: ReportsService,
    private readonly budgets: BudgetsService,
    private readonly goals: GoalsService,
    private readonly cards: CardsService,
  ) {}

  async handleStart(ctx: Context): Promise<void> {
    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    const name = ctx.from?.first_name ?? 'por aí';

    await ctx.reply(
      [
        `Olá, ${name}! Eu sou o Finlar, seu assistente financeiro.`,
        '',
        'No grupo: /configuracoes para vincular a família.',
        'Em seguida, envie coisas como: gastei 76 no posto',
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ajuda', callback_data: 'help' }],
            [{ text: 'Subcategorias', callback_data: 'subcategorias' }],
          ],
        },
      },
    );
  }

  async handleHelp(ctx: Context): Promise<void> {
    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    await ctx.reply(
      [
        'O objetivo é quase nunca precisar de comando — escreva como fala.',
        '',
        'Comandos oficiais:',
        '/start — iniciar o bot',
        '/ajuda — esta ajuda',
        '/resumo — resumo do mês',
        '/extrato — histórico de lançamentos',
        '/contas — contas do mês',
        '/categorias — gastos do mês por categoria',
        '/receita — registrar receita',
        '/despesa — registrar despesa',
        '/transferencia — registrar transferência',
        '/cartoes — cartões e fatura',
        '/fatura — o que ainda temos para pagar',
        '/orcamento — limites por categoria',
        '/limites — limite usado e disponível em cada cartão',
        '/metas — meta de guardar no mês',
        '/recorrentes — contas que se repetem',
        '/desfazer — arquivar o último registro (não apaga de vez)',
        '/auditoria — quem alterou o quê',
        '/editar — corrigir o último lançamento',
        '/configuracoes — registrar o grupo como família',
        '',
        'Pode escrever naturalmente:',
        'mostra todas as compras do Nubank',
        'mostra gastos maiores que 500',
        'procura a compra da Amazon',
        'o que gastamos sexta?',
        'mercado 350',
        'gastei 45 no almoço',
        'recebi meu salário 5500',
        'entrou 1200 de freelance',
        'minha esposa recebeu 3500',
        'todo dia 10 pago 292,80 do terreno',
        'Netflix 55,90 todo dia 7',
        'comprei uma TV de 2400 em 10x no Nubank',
        'como estão nossas finanças?',
        'quanto gastamos com mercado?',
        'quanto eu gastei?',
        'quanto nós gastamos?',
        'quanto minha esposa gastou?',
        'onde estamos gastando mais?',
        'gastamos mais do que mês passado?',
        'orçamento mercado 1200',
        'queremos guardar 2000 por mês',
        'quanto ainda temos para pagar?',
        'como devemos terminar o mês?',
        'extrato hoje',
        'cartão Nubank limite 5000 fecha dia 22 vence dia 29',
        'gastei 120 no Nubank',
        'cartão Santander - limite usado 4500',
        '',
        'Para corrigir o último lançamento:',
        'na verdade foram 46 reais',
        'coloca como restaurante',
        'foi no Nubank',
        '',
        'Também aceito foto ou PDF de comprovante (PIX, TED, boleto, cartão), fatura e conta.',
        'Fatura de cartão em PDF: fatura-nubank-agosto.pdf',
        'PIX/TED entre bancos (Nubank → Inter) é transferência, não despesa.',
        'Depois: paguei a energia',
        '',
        'Em grupos, desative a privacidade do bot no @BotFather (/setprivacy → Disable) para eu ler as mensagens.',
        'Só aceito mensagens no grupo autorizado da família.',
      ].join('\n'),
    );
  }

  async handlePing(ctx: Context): Promise<void> {
    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    await ctx.reply('pong');
  }

  async handleBotAddedToGroup(ctx: Context): Promise<void> {
    if (!this.isGroupChat(ctx) || !ctx.chat || !('title' in ctx.chat)) {
      return;
    }

    const chatId = String(ctx.chat.id);
    if (!(await this.families.isChatAllowed(chatId))) {
      await ctx.reply(unauthorizedChatMessage(chatId));
      return;
    }

    await ctx.reply(
      `Olá! Eu sou o Finlar.\n\nUse /configuracoes para vincular o grupo "${ctx.chat.title}" a uma família.`,
    );
  }

  async handleConfigurar(ctx: Context): Promise<void> {
    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    if (!ctx.chat || !ctx.from) {
      return;
    }

    const title = 'title' in ctx.chat ? ctx.chat.title : 'Família';
    const family = await this.families.upsertFromChat(String(ctx.chat.id), title);
    await this.users.upsertFromTelegram(ctx.from, family.id);
    const withMembers = await this.families.findByChatId(String(ctx.chat.id));

    await ctx.reply(
      this.buildConfigMessage(withMembers ?? family),
      { reply_markup: this.buildConfigKeyboard() },
    );
  }

  async handleSubcategorias(ctx: Context): Promise<void> {
    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    const tree = await this.categories.listTree();
    await ctx.reply(
      `Categorias e subcategorias:\n\n${this.categories.formatTree(tree)}`,
    );
  }

  async handleCategorias(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    await this.installments.materializeDue(context.family.id);
    const rows = await this.reports.expensesByCategory(context.family.id);
    await ctx.reply(buildCategoriasCard(rows));
  }

  async handleOrcamento(ctx: Context, rawText?: string): Promise<void> {
    const messageText =
      rawText ??
      (ctx.message && 'text' in ctx.message ? ctx.message.text : '');
    const args = stripCommandPrefix(messageText, ['orcamento', 'orçamento']);

    if (args) {
      const parsed = parseBudget(`orçamento ${args}`);
      if (parsed?.kind === 'budget') {
        await this.handleBudgetSet(ctx, parsed);
        return;
      }

      await ctx.reply(
        'Não identifiquei a categoria. Exemplo: /orcamento mercado 1200',
      );
      return;
    }

    await this.handleBudgetList(ctx);
  }

  async handleLimite(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, ['limites', 'limite']);
    if (args) {
      const used = parseCardUsed(args) ?? parseCardUsed(`cartão ${args}`);
      if (used) {
        await this.handleCardUsed(ctx, used.name, used.amount);
        return;
      }

      const budget = parseBudget(`orçamento ${args}`);
      if (budget?.kind === 'budget') {
        await this.handleBudgetSet(ctx, budget);
        return;
      }
    }

    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const cards = await this.cards.listWithUsage(context.family.id);
    const filtered = args
      ? cards.filter((card) =>
          card.name.toLowerCase().includes(args.toLowerCase()),
        )
      : cards;

    if (args && filtered.length === 0) {
      await ctx.reply(
        [
          `Não achei limite para "${args}".`,
          'Ex.: /limites  ·  /limite Santander  ·  /limite Santander usado 4500',
        ].join('\n'),
      );
      return;
    }

    await ctx.reply(buildLimitesCard(filtered));
  }

  async handleCartao(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, [
      'cartoes',
      'cartões',
      'cartao',
      'cartão',
    ]);

    if (args) {
      if (/^(apaga|remove|exclui|deleta)/i.test(args)) {
        const parsedDelete = parseCardDelete(args);
        if (parsedDelete) {
          await this.handleCardDelete(ctx, parsedDelete.name);
          return;
        }

        await ctx.reply('Qual cartão? Ex.: /cartao apagar Santander');
        return;
      }

      const used = parseCardUsed(args) ?? parseCardUsed(`cartão ${args}`);
      if (used) {
        await this.handleCardUsed(ctx, used.name, used.amount);
        return;
      }

      const parsed = parseCard(`cartão ${args}`);
      if (parsed?.kind === 'card') {
        await this.handleCardSet(ctx, parsed);
        return;
      }

      if (parsed?.kind === 'card_list') {
        await this.handleCardList(ctx);
        return;
      }

      await ctx.reply(
        'Exemplo: /cartao Nubank limite 5000 fecha dia 22 vence dia 29',
      );
      return;
    }

    await this.handleCardList(ctx);
  }

  private async handleCardList(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const cards = await this.cards.list(context.family.id);
    await ctx.reply(buildCartoesList(cards));
  }

  private async handleCardSet(ctx: Context, parsed: ParsedCard): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const saved = await this.cards.upsertDetails({
      familyId: context.family.id,
      name: parsed.name,
      creditLimit: parsed.creditLimit,
      closingDay: parsed.closingDay,
      dueDay: parsed.dueDay,
    });

    await ctx.reply(
      buildCartaoCard({
        name: saved.name,
        creditLimit: Number(saved.creditLimit),
        closingDay: saved.closingDay,
        dueDay: saved.dueDay,
      }),
    );
  }

  private async handleCardDelete(ctx: Context, name: string): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode alterar cartões neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const removed = await this.cards.removeByName(context.family.id, name);
    if (!removed) {
      await ctx.reply(
        `Não achei o cartão "${name}". Use /cartoes para ver os cadastrados.`,
      );
      return;
    }

    await ctx.reply(`Cartão ${removed.name} removido.`);
  }

  private async handleCardUsed(
    ctx: Context,
    name: string,
    amount: number,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode alterar cartões neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const saved = await this.cards.setUsedAmount(
      context.family.id,
      name,
      amount,
    );
    if (!saved) {
      await ctx.reply(
        `Não achei o cartão "${name}". Use /cartoes para ver os cadastrados.`,
      );
      return;
    }

    const cards = await this.cards.listWithUsage(context.family.id);
    const view = cards.filter((card) => card.name === saved.name);
    await ctx.reply(
      [
        `Limite usado do ${saved.name} atualizado (compras antigas).`,
        '',
        buildLimitesCard(view.length > 0 ? view : cards),
      ].join('\n'),
    );
  }

  private async createLinkedTransaction(data: CreateTransactionInput) {
    const placement =
      data.type === 'EXPENSE'
        ? await this.cards.placementFor(
            data.familyId,
            `${data.rawText ?? ''} ${data.merchant ?? ''} ${data.description}`,
            data.transactionDate,
          )
        : null;

    const saved = await this.transactions.create({
      ...data,
      creditCardId: placement?.cardId ?? data.creditCardId,
      cardInvoiceId: placement?.invoiceId ?? data.cardInvoiceId,
    });

    if (placement) {
      await this.cards.addToInvoice(placement.invoiceId, data.amount);
    }

    return saved;
  }

  private async presentDuplicate(
    ctx: Context,
    data: CreateTransactionInput & { linkCard: boolean },
    existing: DuplicateHit,
  ): Promise<void> {
    const { linkCard, ...payload } = data;
    const draft: PendingDuplicateDraft = {
      id: randomUUID(),
      linkCard,
      existing,
      payload,
    };
    this.pending.saveDuplicate(draft);
    await ctx.reply(buildDuplicateCard(existing), {
      reply_markup: duplicateKeyboard(draft.id),
    });
  }

  private async warnIfDuplicate(
    ctx: Context,
    data: CreateTransactionInput & { linkCard: boolean },
  ): Promise<boolean> {
    if (data.type !== 'EXPENSE' && data.type !== 'INCOME') {
      return false;
    }

    const existing = await this.transactions.findPossibleDuplicate({
      familyId: data.familyId,
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      at: data.transactionDate ?? new Date(),
      description: data.description,
      merchant: data.merchant,
      rawText: data.rawText,
      categoryId: data.categoryId,
    });

    if (!existing) {
      return false;
    }

    await this.presentDuplicate(ctx, data, existing);
    return true;
  }

  private async markDocumentProcessed(documentId?: string | null): Promise<void> {
    if (!documentId) {
      return;
    }

    await this.documents.markProcessed(documentId);
  }

  private async maybeCreateWithDuplicateCheck(
    ctx: Context,
    data: CreateTransactionInput & { linkCard: boolean },
  ): Promise<TransactionWithCard | undefined> {
    if (await this.warnIfDuplicate(ctx, data)) {
      return undefined;
    }

    const { linkCard, ...rest } = data;
    if (linkCard) {
      return this.createLinkedTransaction(rest);
    }

    return this.transactions.create(rest);
  }

  private async handleDuplicateDecision(
    ctx: Context,
    data: string,
  ): Promise<void> {
    const [, action, id] = data.split(':');
    const draft = this.pending.consumeDuplicate(id);
    if (!draft) {
      await ctx.reply('Esse aviso já expirou.');
      return;
    }

    if (action !== 'ok') {
      await ctx.reply('Nada foi adicionado.');
      return;
    }

    const saved = draft.linkCard
      ? await this.createLinkedTransaction(draft.payload)
      : await this.transactions.create(draft.payload);

    try {
      await ctx.editMessageText(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    } catch {
      await ctx.reply(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    }
    await this.maybeReplyBudgetWarning(
      ctx,
      saved.familyId,
      effectiveCategoryId(saved),
      saved.type,
    );
    await this.markDocumentProcessed(draft.payload.sourceDocumentId);
  }

  async handleMeta(ctx: Context): Promise<void> {
    try {
      const args = this.commandArgs(ctx, ['metas', 'meta']);
      if (args) {
        const parsed = parseGoal(`guardar ${args}`);
        if (parsed?.kind === 'goal') {
          await this.handleGoalSet(ctx, parsed.amount);
          return;
        }
      }

      const context = await this.resolveFamilyContext(ctx, false);
      if (!context) {
        return;
      }

      const progress = await this.goals.progress(context.family.id);
      if (!progress) {
        await ctx.reply(
          'Nenhuma meta definida.\nExemplo: /metas 2000\nOu: queremos guardar 2000 por mês',
        );
        return;
      }

      await ctx.reply(buildMetaCard(progress));
    } catch (error) {
      this.logger.error(
        `Falha em /metas: ${error instanceof Error ? error.message : String(error)}`,
      );
      await ctx.reply('Não consegui carregar a meta agora. Tente de novo.');
    }
  }

  private async handleGoalSet(ctx: Context, amount: number): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    await this.goals.upsert(context.family.id, amount);
    const progress = await this.goals.progress(context.family.id);
    if (!progress) {
      await ctx.reply(
        `Meta definida: ${formatMoney(amount)}. Use /metas para acompanhar.`,
      );
      return;
    }

    await ctx.reply(buildMetaCard(progress));
  }

  async handlePayable(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const now = new Date();
    await this.recurring.materializeMonth(
      context.family.id,
      now.getMonth() + 1,
      now.getFullYear(),
    );

    const payables = await this.reports.upcomingPayables(context.family.id, now);
    await ctx.reply(buildPayableCard(payables));
  }

  private async handleBudgetList(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const rows = await this.budgets.list(context.family.id);
    await ctx.reply(buildOrcamentoCard(rows));
  }

  private async handleBudgetSet(
    ctx: Context,
    parsed: ParsedBudget,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const category = await this.categories.findBySlug(parsed.categorySlug);
    if (!category) {
      await ctx.reply(
        `Não encontrei a categoria "${parsed.categorySlug}". Use /subcategorias para ver a lista.`,
      );
      return;
    }

    const saved = await this.budgets.upsert(
      context.family.id,
      category.id,
      parsed.amount,
    );

    await ctx.reply(
      ['Orçamento definido', '', buildOrcamentoCard([{ name: saved.category.name, amount: parsed.amount }])].join('\n'),
    );
  }

  private async maybeReplyBudgetWarning(
    ctx: Context,
    familyId: string,
    categoryId: string,
    type: TransactionType,
  ): Promise<void> {
    if (type !== 'EXPENSE') {
      return;
    }

    const warning = await this.budgets.warningFor(familyId, categoryId);
    if (!warning) {
      return;
    }

    await ctx.reply(buildBudgetWarningCard(warning));
  }

  async handleContas(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const now = new Date();
    let monthIndex = now.getMonth();
    let year = now.getFullYear();
    await this.recurring.materializeMonth(
      context.family.id,
      monthIndex + 1,
      year,
    );
    const next = new Date(year, monthIndex + 1, 1);
    await this.recurring.materializeMonth(
      context.family.id,
      next.getMonth() + 1,
      next.getFullYear(),
    );
    await this.installments.materializeDue(context.family.id);

    let bills = await this.bills.listForMonth(
      context.family.id,
      monthIndex + 1,
      year,
    );

    if (bills.length === 0) {
      const next = new Date(year, monthIndex + 1, 1);
      const upcoming = await this.bills.listForMonth(
        context.family.id,
        next.getMonth() + 1,
        next.getFullYear(),
      );
      if (upcoming.length > 0) {
        bills = upcoming;
        monthIndex = next.getMonth();
        year = next.getFullYear();
      }
    }

    const rows: ContasBill[] = bills.map((bill) => ({
      status: bill.status,
      supplier: bill.supplier,
      amount: Number(bill.amount),
      dueDate: bill.dueDate,
      category: {
        slug: bill.category.slug,
        name: bill.category.name,
      },
    }));

    await ctx.reply(buildContasCard(monthIndex, rows));
  }

  async handleResumo(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const now = new Date();
    await this.recurring.materializeMonth(
      context.family.id,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    await this.installments.materializeDue(context.family.id);

    const summary = await this.reports.monthSummary(context.family.id, now);
    await ctx.reply(buildResumoCard(summary));
  }

  async handlePrevisao(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const now = new Date();
    await this.recurring.materializeMonth(
      context.family.id,
      now.getMonth() + 1,
      now.getFullYear(),
    );

    const forecast = await this.reports.monthForecast(context.family.id, now);
    await ctx.reply(buildPrevisaoCard(forecast));
  }

  async handleExtrato(ctx: Context, rawText?: string): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const messageText =
      rawText ??
      (ctx.message && 'text' in ctx.message ? ctx.message.text : '');
    const args = messageText.replace(/^(?:\/)?extrato(@\S+)?\s*/i, '').trim();
    const range = parseExtratoRange(args);

    if (!range) {
      await ctx.reply(
        'Não entendi o período.\nExemplos: /extrato hoje · /extrato semana · /extrato agosto',
      );
      return;
    }

    const now = new Date();
    await this.recurring.materializeMonth(
      context.family.id,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    await this.installments.materializeDue(context.family.id);

    const { rows, extra } = await this.reports.statement(
      context.family.id,
      range.from,
      range.to,
    );
    await ctx.reply(buildExtratoCard(rows, extra));
  }

  async handleSearch(ctx: Context, parsed: ParsedSearch): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const now = new Date();
    await this.recurring.materializeMonth(
      context.family.id,
      now.getMonth() + 1,
      now.getFullYear(),
    );
    await this.installments.materializeDue(context.family.id);

    const { rows, extra } = await this.reports.search(
      context.family.id,
      parsed,
      now,
    );
    if (rows.length === 0) {
      await ctx.reply('Não encontrei nada com esses filtros.');
      return;
    }

    await ctx.reply(buildExtratoCard(rows, extra));
  }

  async handleReceita(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, ['receita']);
    if (!args) {
      await ctx.reply('Ex.: /receita 5000 salario\nOu: recebi 5000 de salário');
      return;
    }
    await this.registerMovement(
      ctx,
      /^recebi\b/i.test(args) ? args : `recebi ${args}`,
      'MANUAL',
    );
  }

  async handleDespesa(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, ['despesa']);
    if (!args) {
      await ctx.reply('Ex.: /despesa 350 mercado\nOu: mercado 350');
      return;
    }
    await this.registerMovement(ctx, args, 'MANUAL');
  }

  async handleTransferencia(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, ['transferencia']);
    if (!args) {
      await ctx.reply(
        'Ex.: /transferencia 500 do nubank para o inter\nOu: transferi 500 do nubank para o inter',
      );
      return;
    }
    await this.registerMovement(
      ctx,
      /^transferi\b/i.test(args) ? args : `transferi ${args}`,
      'MANUAL',
    );
  }

  async handleRecorrentes(ctx: Context): Promise<void> {
    const args = this.commandArgs(ctx, [
      'recorrencias',
      'recorrencia',
      'recorrentes',
      'recorrente',
    ]);
    if (args) {
      const parsed = parseRecurringBillFromCommand(args);
      if (parsed) {
        await this.handleRecurringBill(ctx, parsed);
        return;
      }

      await ctx.reply(
        'Não identifiquei a conta.\nExemplo: /recorrentes Terreno 289 todo dia 10',
      );
      return;
    }

    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const bills = await this.recurring.list(context.family.id);
    if (bills.length === 0) {
      await ctx.reply(
        'Nenhuma conta recorrente.\nExemplo: /recorrentes Terreno 289 todo dia 10',
      );
      return;
    }

    const lines = bills.map((bill) => {
      const amount = Number(bill.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const pending = bill.bills ?? [];
      const open = pending
        .map((item) => monthName(item.referenceMonth - 1))
        .join(', ');
      const head = `${bill.category.emoji} ${bill.supplier} ${amount} · todo dia ${bill.dayOfMonth}`;
      return open ? `${head}\n   Em aberto: ${open}` : head;
    });
    await ctx.reply(
      [
        '🔁 Recorrentes (cadastro mensal)',
        '',
        ...lines,
        '',
        'O /fatura soma cada mês gerado ainda não pago.',
      ].join('\n'),
    );
  }

  async handleEditar(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const last = await this.transactions.findLastByUser(
      context.family.id,
      context.user.id,
    );
    if (!last) {
      await ctx.reply('Não achei um lançamento recente para editar.');
      return;
    }

    await this.handleEditPrompt(ctx, last.id);
  }

  private async handleRecurringBill(
    ctx: Context,
    parsed: ParsedRecurringBill,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const slug = matchCategoryKeyword(parsed.label) ?? 'outros';
    const category = await this.categories.findBySlug(slug);
    const fallback = category ?? (await this.categories.findBySlug('outros'));
    if (!fallback) {
      await ctx.reply('Não encontrei categorias para salvar essa conta.');
      return;
    }

    const saved = await this.recurring.upsert({
      familyId: context.family.id,
      userId: context.user.id,
      categoryId: fallback.id,
      supplier: parsed.label,
      amount: parsed.amount,
      dayOfMonth: parsed.dayOfMonth,
    });

    await ctx.reply(
      [
        '🔁 Conta recorrente criada',
        '',
        saved.supplier,
        formatMoney(Number(saved.amount)),
        `Todo dia ${saved.dayOfMonth}`,
      ].join('\n'),
    );
  }

  private async handleInstallment(
    ctx: Context,
    parsed: ParsedInstallment,
    rawText: string,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const slug = matchCategoryKeyword(parsed.label) ?? 'outros';
    const category = await this.categories.findBySlug(slug);
    const fallback = category ?? (await this.categories.findBySlug('outros'));
    if (!fallback) {
      await ctx.reply('Não encontrei categorias para salvar essa compra.');
      return;
    }

    const plan = await this.installments.createPlan({
      familyId: context.family.id,
      userId: context.user.id,
      categoryId: fallback.id,
      description: parsed.label,
      merchant: parsed.card ?? parsed.label,
      rawText,
      totalAmount: parsed.amount,
      installmentCount: parsed.installmentCount,
      cardName: parsed.card,
      source: 'RULE',
    });

    await ctx.reply(
      buildInstallmentCard({
        description: plan.description,
        totalAmount: Number(plan.totalAmount),
        installmentCount: plan.installmentCount,
        installmentAmount: Number(plan.installmentAmount),
        cardName: plan.card?.name ?? parsed.card,
      }),
    );
  }

  async handleText(ctx: Context, overrideText?: string): Promise<void> {
    if (!ctx.from || !ctx.chat) {
      return;
    }

    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    const text =
      overrideText ??
      (ctx.message && 'text' in ctx.message ? ctx.message.text : undefined);

    if (!text) {
      return;
    }

    if (text.startsWith('/')) {
      await this.dispatchSlashCommand(ctx, text);
      return;
    }

    const parsed = parseMessage(text);

    if (parsed.kind === 'correction') {
      await this.handleCorrection(ctx, parsed);
      return;
    }

    if (parsed.kind === 'recurring_bill') {
      await this.handleRecurringBill(ctx, parsed);
      return;
    }

    if (parsed.kind === 'installment') {
      await this.handleInstallment(ctx, parsed, text);
      return;
    }

    if (parsed.kind === 'budget') {
      await this.handleBudgetSet(ctx, parsed);
      return;
    }

    if (parsed.kind === 'budget_list') {
      await this.handleBudgetList(ctx);
      return;
    }

    if (parsed.kind === 'card_limits') {
      await this.handleLimite(ctx);
      return;
    }

    if (parsed.kind === 'card') {
      await this.handleCardSet(ctx, parsed);
      return;
    }

    if (parsed.kind === 'card_delete') {
      await this.handleCardDelete(ctx, parsed.name);
      return;
    }

    if (parsed.kind === 'card_used') {
      await this.handleCardUsed(ctx, parsed.name, parsed.amount);
      return;
    }

    if (parsed.kind === 'card_list') {
      await this.handleCardList(ctx);
      return;
    }

    if (parsed.kind === 'goal') {
      await this.handleGoalSet(ctx, parsed.amount);
      return;
    }

    if (parsed.kind === 'goal_status') {
      await this.handleMeta(ctx);
      return;
    }

    if (parsed.kind === 'payable') {
      await this.handlePayable(ctx);
      return;
    }

    if (parsed.kind === 'bill_payment') {
      await this.handleBillPayment(ctx, parsed);
      return;
    }

    if (parsed.kind === 'query') {
      await this.replyFinanceQuery(ctx, parsed);
      return;
    }

    if (parsed.kind === 'forecast') {
      await this.handlePrevisao(ctx);
      return;
    }

    if (parsed.kind === 'statement') {
      await this.handleExtrato(ctx, text);
      return;
    }

    if (parsed.kind === 'search') {
      await this.handleSearch(ctx, parsed);
      return;
    }

    if (parsed.kind === 'summary') {
      await this.handleResumo(ctx);
      return;
    }

    if (parsed.kind === 'movement') {
      await this.registerMovement(ctx, text);
      return;
    }

    if (looksLikeFinanceQuestion(text)) {
      const interpreted = this.ai.isEnabled()
        ? await this.ai.interpretFinanceQuestion(text)
        : null;
      if (interpreted) {
        await this.replyFinanceQuery(ctx, interpreted);
        return;
      }

      await ctx.reply(
        [
          'Não entendi a pergunta. Exemplos:',
          'quanto gastamos com mercado?',
          'quanto gastamos com delivery?',
          'quanto minha esposa gastou este mês?',
          'quanto nós gastamos?',
          'quanto eu gastei?',
          'onde estamos gastando mais?',
          'gastamos mais do que mês passado?',
          'quais nossas maiores despesas?',
          'quanto gastamos com combustível nos últimos três meses?',
          'quanto ainda temos para pagar?',
          'como devemos terminar o mês?',
          'mostra todas as compras do Nubank',
          'mostra gastos maiores que 500',
          'procura a compra da Amazon',
          'o que gastamos sexta?',
        ].join('\n'),
      );
      return;
    }

    await ctx.reply(
      'Não identifiquei um valor. Exemplos: gastei 45 no almoço · mercado 350',
    );
  }

  async handlePhoto(ctx: Context): Promise<void> {
    if (!ctx.message || !('photo' in ctx.message)) {
      return;
    }

    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const caption = ctx.message.caption;

    await this.analyzeMedia(ctx, largest.file_id, 'image/jpeg', caption);
  }

  async handleDocument(ctx: Context): Promise<void> {
    const document = this.getDocument(ctx);
    if (!document) {
      return;
    }

    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    if (this.isPdf(document.mime_type, document.file_name)) {
      await this.handlePdf(ctx, document.file_id, document.file_name);
      return;
    }

    if (document.mime_type?.startsWith('image/')) {
      await this.analyzeMedia(
        ctx,
        document.file_id,
        document.mime_type,
        ctx.message && 'caption' in ctx.message ? ctx.message.caption : undefined,
      );
      return;
    }

    const context = await this.resolveFamilyContext(ctx, false);
    if (context) {
      await this.documents.create({
        familyId: context.family.id,
        userId: context.user.id,
        telegramFileId: document.file_id,
        type: 'UNKNOWN',
        status: 'PENDING',
        extractedText: document.file_name,
      });
    }

    await ctx.reply(
      `Recebi o documento: ${document.file_name ?? 'sem nome'}. Ainda não processo esse formato. Envie PDF, foto ou o valor em texto.`,
    );
  }

  async handlePdf(
    ctx: Context,
    fileId?: string,
    fileName?: string,
  ): Promise<void> {
    const document = this.getDocument(ctx);
    const id = fileId ?? document?.file_id;
    if (!id) {
      await ctx.reply('Não consegui ler esse PDF. Envie o arquivo de novo.');
      return;
    }

    const caption =
      ctx.message && 'caption' in ctx.message ? ctx.message.caption : undefined;

    await this.analyzeMedia(ctx, id, 'application/pdf', caption, {
      isPdf: true,
      fileName: fileName ?? document?.file_name,
    });
  }

  async handleCallback(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
      return;
    }

    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return;
    }

    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (data === 'help') {
      await this.handleHelp(ctx);
      return;
    }

    if (data === 'status') {
      await ctx.reply('Bot online e pronto para receber mensagens.');
      return;
    }

    if (data === 'subcategorias') {
      await this.handleSubcategorias(ctx);
      return;
    }

    if (data === 'family:add_members') {
      await this.handleAddMembersPrompt(ctx);
      return;
    }

    if (data === 'family:join') {
      await this.handleJoinFamily(ctx);
      return;
    }

    if (data === 'family:admins') {
      await this.handleAddAdmins(ctx);
      return;
    }

    if (data.startsWith('family:perm:')) {
      await this.handlePermissionChange(ctx, data);
      return;
    }

    if (data.startsWith('tx:edit:')) {
      await this.handleEditPrompt(ctx, data.slice('tx:edit:'.length));
      return;
    }

    if (data.startsWith('tx:del:')) {
      await this.handleDeleteTransaction(ctx, data.slice('tx:del:'.length));
      return;
    }

    if (data.startsWith('pend:')) {
      await this.handlePendingDecision(ctx, data);
      return;
    }

    if (data.startsWith('rcpt:')) {
      await this.handleReceiptDecision(ctx, data);
      return;
    }

    if (data.startsWith('bill:')) {
      await this.handleBillDecision(ctx, data);
      return;
    }

    if (data.startsWith('inv:')) {
      await this.handleInvoiceDecision(ctx, data);
      return;
    }

    if (data.startsWith('dup:')) {
      await this.handleDuplicateDecision(ctx, data);
      return;
    }

    this.logger.log(`Callback sem rota: ${data}`);
  }

  private async registerMovement(
    ctx: Context,
    text: string,
    origin: TransactionSource = 'TEXT',
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    const { family, user } = context;
    const allowed = await this.canRegister(ctx, family, user);
    if (!allowed) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const result = await this.engine.categorize({
      text,
      familyId: family.id,
    });

    if (!result) {
      await ctx.reply(
        'Não consegui entender essa movimentação. Tente: gastei 45 no almoço',
      );
      return;
    }

    if (isAmbiguousTransfer(text)) {
      const draft: PendingDraft = {
        id: randomUUID(),
        familyId: family.id,
        userId: user.id,
        type: result.type,
        amount: result.amount,
        description: result.description,
        merchant: result.merchant,
        rawText: text,
        categoryId: result.categoryId,
        source: origin,
        categorizationSource: result.source,
        confidence: result.confidence,
      };
      this.pending.save(draft);

      await ctx.reply(
        [
          'Como devo registrar?',
          '',
          `${formatMoney(result.amount)}${result.merchant ? ` para ${result.merchant}` : ''}`,
        ].join('\n'),
        { reply_markup: pendingKeyboard(draft.id) },
      );
      return;
    }

    const saved = await this.maybeCreateWithDuplicateCheck(ctx, {
      familyId: family.id,
      userId: user.id,
      type: result.type,
      amount: result.amount,
      description: result.description,
      merchant: result.merchant,
      rawText: text,
      categoryId: result.categoryId,
      source: origin,
      categorizationSource: result.source,
      confidence: result.confidence,
      linkCard: true,
    });

    if (!saved) {
      return;
    }

    await ctx.reply(buildMovementCard(saved), {
      reply_markup: movementKeyboard(saved.id),
    });
    await this.maybeReplyBudgetWarning(
      ctx,
      family.id,
      effectiveCategoryId(saved),
      saved.type,
    );
  }

  async handleUndo(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const last = await this.transactions.findLastByUser(
      context.family.id,
      context.user.id,
    );

    if (!last) {
      await ctx.reply('Não há registro recente para desfazer.');
      return;
    }

    await this.transactions.delete(last.id, context.user.id);
    await ctx.reply(
      `Último registro arquivado (não apagado de vez): ${formatMoney(Number(last.amount))} (${last.description}).`,
    );
  }

  async handleAuditoria(ctx: Context): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const lines = await this.transactions.listHistory(context.family.id);
    if (lines.length === 0) {
      await ctx.reply('Ainda não há alterações registradas nesta família.');
      return;
    }

    await ctx.reply(`🧾 Auditoria\n\n${lines.join('\n\n')}`);
  }

  private async analyzeMedia(
    ctx: Context,
    fileId: string,
    mimeType: string,
    caption?: string,
    options?: { isPdf?: boolean; fileName?: string },
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx);
    if (!context) {
      return;
    }

    if (!(await this.canRegister(ctx, context.family, context.user))) {
      await ctx.reply(
        'Você ainda não pode registrar movimentações neste grupo. Use /configurar e [Adicionar membros].',
      );
      return;
    }

    const isPdf = Boolean(options?.isPdf);
    const needsVision = !isPdf && !this.ai.isEnabled();

    if (needsVision) {
      if (caption) {
        await this.handleText(ctx, caption);
        return;
      }

      await ctx.reply(
        'Para ler fotos de comprovantes e contas, configure OPENAI_API_KEY. Ou envie um PDF com texto, ou o valor em texto: paguei 230 na Enel',
      );
      return;
    }

    await ctx.reply('Analisando o documento...');

    const buffer = await this.downloadTelegramFileBuffer(ctx, fileId);
    if (!buffer) {
      await ctx.reply('Não consegui baixar o arquivo. Tente enviar de novo.');
      return;
    }

    const ingested = await this.documents.ingest({
      familyId: context.family.id,
      userId: context.user.id,
      telegramFileId: fileId,
      buffer,
      mimeType,
      caption,
      fileName: options?.fileName,
      isPdf,
    });

    await this.presentIngestedDocument(ctx, ingested, {
      caption,
      source: isPdf ? 'PDF' : 'PHOTO',
    });
  }

  private async presentIngestedDocument(
    ctx: Context,
    ingested: IngestResult,
    options: { caption?: string; source: TransactionSource },
  ): Promise<void> {
    if (ingested.status === 'scanned_pdf') {
      await ctx.reply(
        'Este PDF parece escaneado (sem texto). Envie uma foto nítida do comprovante, da fatura ou da conta.',
      );
      return;
    }

    if (ingested.status === 'bank_statement') {
      await ctx.reply(
        'Recebi o extrato bancário. O detalhamento linha a linha ainda não está pronto — por enquanto use /extrato para o que já está no Finlar.',
      );
      return;
    }

    if (ingested.status === 'failed') {
      if (options.caption) {
        await this.handleText(ctx, options.caption);
        return;
      }

      await ctx.reply(
        ingested.errors.join('\n') ||
          'Não consegui ler valor neste documento. Envie o valor em texto, por exemplo: paguei 230 na Enel',
      );
      return;
    }

    if (ingested.status === 'invoice') {
      await this.presentIngestedInvoice(ctx, ingested);
      return;
    }

    if (ingested.status === 'bill') {
      await this.presentIngestedBill(ctx, ingested, options.source);
      return;
    }

    await this.presentIngestedReceipt(ctx, ingested, options.source);
  }

  private async presentIngestedInvoice(
    ctx: Context,
    ingested: Extract<IngestResult, { status: 'invoice' }>,
  ): Promise<void> {
    const draft: PendingInvoiceDraft = {
      id: randomUUID(),
      familyId: ingested.document.familyId,
      userId: ingested.document.userId,
      cardName: ingested.cardName,
      fileName: ingested.fileName,
      documentId: ingested.document.id,
      items: ingested.items,
    };
    this.pending.saveInvoice(draft);

    const counts = countInvoiceItems(ingested.items);
    await ctx.reply(buildInvoicePreviewCard(counts), {
      reply_markup: invoiceKeyboard(draft.id),
    });
  }

  private async presentIngestedBill(
    ctx: Context,
    ingested: Extract<IngestResult, { status: 'bill' }>,
    source: TransactionSource,
  ): Promise<void> {
    const extracted = ingested.extraction;
    const due = extracted.dueDate ?? new Date();
    const draft: PendingBillDraft = {
      id: randomUUID(),
      familyId: ingested.document.familyId,
      userId: ingested.document.userId,
      amount: extracted.amount as number,
      dueDate: extracted.dueDate,
      supplier: extracted.supplier ?? extracted.destination ?? 'Conta',
      barcode: extracted.barcode,
      categoryId: ingested.category.id,
      referenceMonth: due.getMonth() + 1,
      referenceYear: due.getFullYear(),
      documentId: ingested.document.id,
      source,
    };
    this.pending.saveBill(draft);
    await ctx.reply(buildBillPreview(draft, ingested.category), {
      reply_markup: billKeyboard(draft.id),
    });
  }

  private async presentIngestedReceipt(
    ctx: Context,
    ingested: Extract<IngestResult, { status: 'receipt' }>,
    source: TransactionSource,
  ): Promise<void> {
    const extracted = ingested.extraction;
    const description =
      extracted.destination ?? extracted.supplier ?? 'Pagamento';

    if (extracted.movementType !== 'TRANSFER' && ingested.duplicate) {
      await this.presentDuplicate(
        ctx,
        {
          familyId: ingested.document.familyId,
          userId: ingested.document.userId,
          type: extracted.movementType,
          amount: extracted.amount as number,
          description,
          merchant: extracted.destination ?? extracted.supplier ?? undefined,
          rawText:
            `comprovante ${extracted.paymentType ?? ''} ${description}`.trim(),
          categoryId: ingested.category.id,
          source,
          categorizationSource: ingested.categorizationSource,
          transactionDate: extracted.date ?? new Date(),
          sourceDocumentId: ingested.document.id,
          linkCard: false,
        },
        ingested.duplicate,
      );
      return;
    }

    const draft: PendingReceiptDraft = {
      id: randomUUID(),
      familyId: ingested.document.familyId,
      userId: ingested.document.userId,
      amount: extracted.amount as number,
      paidAt: extracted.date,
      destination: extracted.destination ?? extracted.supplier,
      bank: extracted.bank ?? extracted.originBank,
      originBank: extracted.originBank,
      destinationBank: extracted.destinationBank,
      paymentType: extracted.paymentType,
      movementType: extracted.movementType,
      categoryId: ingested.category.id,
      documentId: ingested.document.id,
      source,
      categorizationSource: ingested.categorizationSource,
    };
    this.pending.saveReceipt(draft);
    await ctx.reply(buildReceiptPreview(draft, ingested.category), {
      reply_markup: receiptKeyboard(draft.id, draft.movementType),
    });
  }

  private async handleInvoiceDecision(
    ctx: Context,
    data: string,
  ): Promise<void> {
    const [, action, id] = data.split(':');

    if (action === 'rev') {
      const draft = this.pending.peekInvoice(id);
      if (!draft) {
        await ctx.reply('Essa fatura já expirou. Envie o PDF de novo.');
        return;
      }

      await ctx.reply(buildInvoiceReviewCard(draft.items), {
        reply_markup: invoiceKeyboard(draft.id),
      });
      return;
    }

    const draft = this.pending.consumeInvoice(id);
    if (!draft) {
      await ctx.reply('Essa fatura já foi importada ou expirou. Envie o PDF de novo.');
      return;
    }

    if (action !== 'ok') {
      await ctx.reply('Importação cancelada.');
      return;
    }

    await this.cards.upsert(draft.familyId, draft.cardName);

    const toImport = draft.items.filter((item) => item.status === 'recognized');
    for (const item of toImport) {
      await this.createLinkedTransaction({
        familyId: draft.familyId,
        userId: draft.userId,
        type: 'EXPENSE',
        amount: item.amount,
        description: item.description,
        merchant: item.merchant,
        rawText: `fatura ${draft.cardName} ${item.merchant}`,
        categoryId: item.categoryId,
        source: 'IMPORT',
        categorizationSource: item.source,
        confidence: item.confidence,
        transactionDate: item.date ?? undefined,
        sourceDocumentId: draft.documentId,
      });
    }

    const counts = countInvoiceItems(draft.items);
    await ctx.reply(
      buildInvoiceImportCard(draft.cardName, counts, toImport.length),
    );
    await this.markDocumentProcessed(draft.documentId);
  }

  private async handleReceiptDecision(ctx: Context, data: string): Promise<void> {
    const [, action, id] = data.split(':');
    const draft = this.pending.consumeReceipt(id);

    if (!draft) {
      await ctx.reply('Esse comprovante já expirou. Envie a foto de novo.');
      return;
    }

    if (action === 'no') {
      await ctx.reply('Comprovante ignorado.');
      return;
    }

    if (action === 'edit') {
      await ctx.reply(
        'Sem problema. Envie o lançamento em texto, por exemplo: paguei 220 na Enel',
      );
      return;
    }

    let type: TransactionType = draft.movementType;
    if (action === 'exp') {
      type = 'EXPENSE';
    } else if (action === 'tr') {
      type = 'TRANSFER';
    } else if (action === 'ok' && !type) {
      type = 'EXPENSE';
    }

    let categoryId = draft.categoryId;
    if (type === 'TRANSFER') {
      const outros = await this.categories.findBySlug('outros');
      if (outros) {
        categoryId = outros.id;
      }
    }

    const route =
      draft.originBank || draft.destinationBank
        ? `${draft.originBank ?? draft.bank ?? ''} → ${draft.destinationBank ?? draft.destination ?? ''}`.trim()
        : null;
    const description =
      type === 'TRANSFER'
        ? route && route !== '→'
          ? route
          : 'Transferência'
        : (draft.destination ?? 'Pagamento');

    const saved = await this.maybeCreateWithDuplicateCheck(ctx, {
      familyId: draft.familyId,
      userId: draft.userId,
      type,
      amount: draft.amount,
      description,
      merchant: draft.destination ?? undefined,
      rawText: `comprovante ${draft.paymentType ?? ''} ${description}`.trim(),
      categoryId,
      source: draft.source,
      categorizationSource: draft.categorizationSource,
      transactionDate: draft.paidAt ?? undefined,
      sourceDocumentId: draft.documentId,
      linkCard: false,
    });

    if (!saved) {
      return;
    }

    try {
      await ctx.editMessageText(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    } catch {
      await ctx.reply(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    }
    await this.maybeReplyBudgetWarning(
      ctx,
      draft.familyId,
      effectiveCategoryId(saved),
      saved.type,
    );
    await this.markDocumentProcessed(draft.documentId);
  }

  private async handleBillDecision(ctx: Context, data: string): Promise<void> {
    const [, action, id] = data.split(':');
    const draft = this.pending.consumeBill(id);

    if (!draft) {
      await ctx.reply('Essa conta já expirou. Envie a foto de novo.');
      return;
    }

    if (action === 'x') {
      await ctx.reply('Conta ignorada.');
      return;
    }

    if (action === 'add') {
      await this.bills.create({
        familyId: draft.familyId,
        userId: draft.userId,
        categoryId: draft.categoryId,
        supplier: draft.supplier,
        amount: draft.amount,
        dueDate: draft.dueDate,
        barcode: draft.barcode,
        status: 'PENDING',
        referenceMonth: draft.referenceMonth,
        referenceYear: draft.referenceYear,
        documentId: draft.documentId,
      });
      await ctx.reply(
        `Conta de ${draft.supplier} adicionada como pendente (${formatMoney(draft.amount)}). Quando pagar, envie: paguei a energia`,
      );
      await this.markDocumentProcessed(draft.documentId);
      return;
    }

    const saved = await this.transactions.create({
      familyId: draft.familyId,
      userId: draft.userId,
      type: 'EXPENSE',
      amount: draft.amount,
      description: draft.supplier,
      merchant: draft.supplier,
      rawText: `conta ${draft.supplier}`,
      categoryId: draft.categoryId,
      source: draft.source,
      categorizationSource: 'AI',
      sourceDocumentId: draft.documentId,
      transactionDate: draft.dueDate ?? undefined,
    });

    await this.bills.create({
      familyId: draft.familyId,
      userId: draft.userId,
      categoryId: draft.categoryId,
      supplier: draft.supplier,
      amount: draft.amount,
      dueDate: draft.dueDate,
      barcode: draft.barcode,
      status: 'PAID',
      referenceMonth: draft.referenceMonth,
      referenceYear: draft.referenceYear,
      documentId: draft.documentId,
      paidTransactionId: saved.id,
    });

    await ctx.reply(buildMovementCard(saved), {
      reply_markup: movementKeyboard(saved.id),
    });
    await this.maybeReplyBudgetWarning(
      ctx,
      draft.familyId,
      effectiveCategoryId(saved),
      saved.type,
    );
    await this.markDocumentProcessed(draft.documentId);
  }

  private async handleBillPayment(
    ctx: Context,
    parsed: ParsedBillPayment,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const bill = await this.bills.findPendingByHint(
      context.family.id,
      parsed.hint,
    );

    if (!bill) {
      await ctx.reply(
        `Não encontrei conta pendente de "${parsed.hint}". Envie a foto da conta ou o valor em texto.`,
      );
      return;
    }

    const saved = await this.transactions.create({
      familyId: bill.familyId,
      userId: context.user.id,
      type: 'EXPENSE',
      amount: Number(bill.amount),
      description: bill.supplier,
      merchant: bill.supplier,
      rawText: `paguei ${parsed.hint}`,
      categoryId: bill.categoryId,
      source: 'TEXT',
      categorizationSource: 'MANUAL',
    });

    await this.bills.markPaid(bill.id, saved.id);
    await ctx.reply(buildMovementCard(saved), {
      reply_markup: movementKeyboard(saved.id),
    });
    await this.maybeReplyBudgetWarning(
      ctx,
      saved.familyId,
      effectiveCategoryId(saved),
      saved.type,
    );
  }

  private async resolveCategory(text: string) {
    const slug = matchCategoryKeyword(text) ?? 'outros';
    const category = await this.categories.findBySlug(slug);
    if (category) {
      return {
        id: category.id,
        emoji: category.parent?.emoji ?? category.emoji,
        name: category.parent?.name ?? category.name,
      };
    }

    const fallback = await this.categories.findBySlug('outros');
    return {
      id: fallback?.id ?? '',
      emoji: fallback?.emoji ?? '📦',
      name: fallback?.name ?? 'Outros',
    };
  }

  private async downloadTelegramFileBuffer(
    ctx: Context,
    fileId: string,
  ): Promise<Buffer | null> {
    try {
      const file = await ctx.telegram.getFile(fileId);
      if (!file.file_path) {
        return null;
      }

      const link = await ctx.telegram.getFileLink(fileId);
      const response = await fetch(link);
      if (!response.ok) {
        return null;
      }

      return Buffer.from(await response.arrayBuffer());
    } catch {
      this.logger.warn('Falha ao baixar arquivo do Telegram.');
      return null;
    }
  }

  private async handleCorrection(
    ctx: Context,
    correction: ParsedCorrection,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const last = await this.transactions.findLastByUser(
      context.family.id,
      context.user.id,
    );

    if (!last) {
      await ctx.reply('Não encontrei um registro recente para corrigir.');
      return;
    }

    const patch: {
      amount?: number;
      description?: string;
      merchant?: string;
      categoryId?: string;
      categorizationSource?: 'MANUAL';
      confidence?: number;
    } = {};

    if (correction.amount !== undefined) {
      patch.amount = correction.amount;
    }

    if (correction.merchant) {
      patch.merchant = correction.merchant;
      if (!last.category.parent) {
        patch.description = correction.merchant;
      }
    }

    let learned: { pattern: string; label: string } | null = null;
    let learnedCategoryName: string | undefined;

    if (correction.categoryHint) {
      const slug = matchCategoryKeyword(correction.categoryHint);
      if (!slug) {
        await ctx.reply(
          `Não reconheci a categoria "${correction.categoryHint}". Use /subcategorias para ver a lista.`,
        );
        return;
      }

      const category = await this.categories.findBySlug(slug);
      if (!category) {
        await ctx.reply('Não encontrei essa categoria.');
        return;
      }

      patch.categoryId = category.id;
      patch.description = category.name;
      patch.categorizationSource = 'MANUAL';
      patch.confidence = 1;
      learnedCategoryName = `${category.emoji} ${category.parent?.name ?? category.name}`;

      const alreadySame =
        category.id === last.subcategoryId ||
        (category.id === last.categoryId && !last.subcategoryId);

      if (!alreadySame && last.type !== 'TRANSFER') {
        learned = await this.categories.rememberCorrection({
          familyId: context.family.id,
          categoryId: category.id,
          merchant: patch.merchant ?? last.merchant,
          rawText: last.rawText,
          description: last.description,
        });
      }
    }

    const updated = await this.transactions.update(last.id, patch, context.user.id);
    await ctx.reply(buildMovementCard(updated), {
      reply_markup: movementKeyboard(updated.id),
    });

    if (learned && learnedCategoryName) {
      await ctx.reply(
        `Aprendi: da próxima vez, ${learned.label} entra em ${learnedCategoryName} nesta família.`,
      );
    }
  }

  private async handleEditPrompt(ctx: Context, transactionId: string): Promise<void> {
    const tx = await this.transactions.findById(transactionId);
    if (!tx) {
      await ctx.reply('Esse registro não existe mais.');
      return;
    }

    await ctx.reply(
      [
        'O que você quer corrigir?',
        '',
        'na verdade foram 46 reais',
        'coloca como restaurante',
        'foi no Nubank',
      ].join('\n'),
    );
  }

  private async handleDeleteTransaction(
    ctx: Context,
    transactionId: string,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    const tx = await this.transactions.findById(transactionId);
    if (!tx) {
      await ctx.reply('Esse registro já foi excluído.');
      return;
    }

    await this.transactions.delete(transactionId, context.user.id);

    try {
      await ctx.editMessageText(
        `Movimentação arquivada (não apagada de vez): ${formatMoney(Number(tx.amount))} (${tx.description}).`,
      );
    } catch {
      await ctx.reply(
        `Movimentação arquivada (não apagada de vez): ${formatMoney(Number(tx.amount))} (${tx.description}).`,
      );
    }
  }

  private async handlePendingDecision(ctx: Context, data: string): Promise<void> {
    const [, action, id] = data.split(':');
    const draft = this.pending.consume(id);

    if (!draft) {
      await ctx.reply('Esse rascunho já expirou. Envie a movimentação de novo.');
      return;
    }

    if (action === 'x') {
      await ctx.reply('Cancelado. Nada foi registrado.');
      return;
    }

    let type: TransactionType = 'EXPENSE';
    let categoryId = draft.categoryId;

    if (action === 'tr') {
      type = 'TRANSFER';
      const outros = await this.categories.findBySlug('outros');
      if (outros) {
        categoryId = outros.id;
      }
    } else if (action === 'loan') {
      type = 'LOAN';
      const loan = await this.categories.findBySlug('emprestimos');
      if (loan) {
        categoryId = loan.id;
      }
    }

    const saved = await this.maybeCreateWithDuplicateCheck(ctx, {
      familyId: draft.familyId,
      userId: draft.userId,
      type,
      amount: draft.amount,
      description: draft.description,
      merchant: draft.merchant,
      rawText: draft.rawText,
      categoryId,
      source: draft.source,
      categorizationSource: draft.categorizationSource,
      confidence: draft.confidence,
      linkCard: true,
    });

    if (!saved) {
      return;
    }

    try {
      await ctx.editMessageText(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    } catch {
      await ctx.reply(buildMovementCard(saved), {
        reply_markup: movementKeyboard(saved.id),
      });
    }
    await this.maybeReplyBudgetWarning(
      ctx,
      draft.familyId,
      effectiveCategoryId(saved),
      saved.type,
    );
  }

  private async replyFinanceQuery(
    ctx: Context,
    query: ParsedQuery,
  ): Promise<void> {
    const context = await this.resolveFamilyContext(ctx, false);
    if (!context) {
      return;
    }

    await this.installments.materializeDue(context.family.id);

    const members = await this.families.listMembers(context.family.id);
    const resolved = resolveQueryMember({
      currentUserId: context.user.id,
      person: query.person,
      memberHint: query.memberHint,
      members,
    });

    if (resolved.missing === 'spouse') {
      await ctx.reply(
        'Não encontrei outro membro na família. Peça para a pessoa enviar uma mensagem no grupo.',
      );
      return;
    }

    if (resolved.missing === 'named') {
      await ctx.reply(
        `Não encontrei ${resolved.label} na família. Quem for registrar precisa mandar uma mensagem no grupo.`,
      );
      return;
    }

    const who = resolved.label;
    const userId = resolved.userId;

    const now = new Date();
    const { from, to } = queryDateRange(query.months, now);

    if (query.intent === 'compare') {
      const { current, previous } = await this.reports.compareMonths(
        context.family.id,
        now,
      );
      await ctx.reply(buildCompareAnswer(current, previous));
      return;
    }

    if (query.intent === 'top_categories') {
      const rows = await this.reports.expensesByCategory(
        context.family.id,
        now,
        query.months,
        userId,
      );
      await ctx.reply(buildTopCategoriesAnswer(rows, query.months));
      return;
    }

    if (query.intent === 'top_expenses') {
      const rows = await this.reports.topExpenses(
        context.family.id,
        from,
        to,
        5,
        userId,
      );
      await ctx.reply(buildTopExpensesAnswer(rows, query.months));
      return;
    }

    let categoryIds: string[] | undefined;
    let category: { emoji: string; name: string } | undefined;

    if (query.intent === 'by_category') {
      if (!query.categorySlug) {
        await ctx.reply(
          'Não identifiquei a categoria. Use /subcategorias para ver a lista.',
        );
        return;
      }

      const found = await this.categories.findBySlug(query.categorySlug);
      if (!found) {
        await ctx.reply(
          `Não encontrei a categoria "${query.categorySlug}". Use /subcategorias para ver a lista.`,
        );
        return;
      }

      categoryIds = this.categories.categorySubtreeIds(found);
      category = { emoji: found.emoji, name: found.name };
    }

    const amount = await this.reports.sumExpenses({
      familyId: context.family.id,
      userId,
      categoryIds,
      from,
      to,
    });

    await ctx.reply(
      buildSpendAnswer({
        who,
        amount,
        category,
        months: query.months,
      }),
    );
  }

  private commandArgs(ctx: Context, names: string[]): string {
    const messageText =
      ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    return stripCommandPrefix(messageText, names);
  }

  private async resolveFamilyContext(
    ctx: Context,
    _createPrivate = true,
  ): Promise<{ family: FamilyWithUsers; user: User } | null> {
    if (!ctx.chat || !ctx.from) {
      return null;
    }

    if (!(await this.ensureAuthorizedGroup(ctx))) {
      return null;
    }

    const chatId = String(ctx.chat.id);
    const family = await this.families.findByChatId(chatId);

    try {
      this.families.assertBoundChat(family, chatId);
    } catch {
      await ctx.reply(
        'Este grupo ainda não foi configurado. Use /configuracoes para vincular a família.',
      );
      return null;
    }

    if (!family) {
      return null;
    }

    const user = await this.users.upsertFromTelegram(ctx.from, family.id);
    return { family, user };
  }

  private async canRegister(
    ctx: Context,
    family: Family,
    user: User,
  ): Promise<boolean> {
    if (family.transactionPermission === 'ALL_MEMBERS') {
      return true;
    }

    if (family.transactionPermission === 'SELECTED_MEMBERS') {
      return user.familyId === family.id;
    }

    if (!ctx.from) {
      return false;
    }

    const member = await ctx.getChatMember(ctx.from.id);
    return member.status === 'creator' || member.status === 'administrator';
  }

  private async handleAddMembersPrompt(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return;
    }

    const family = await this.families.findByChatId(String(ctx.chat.id));
    if (!family) {
      await ctx.reply('Use /configurar antes de adicionar membros.');
      return;
    }

    await ctx.reply(
      `Quem quiser registrar movimentações em ${family.name}, toque no botão.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Entrar na família', callback_data: 'family:join' }],
            [
              {
                text: 'Adicionar administradores',
                callback_data: 'family:admins',
              },
            ],
          ],
        },
      },
    );
  }

  private async handleJoinFamily(ctx: Context): Promise<void> {
    if (!ctx.chat || !ctx.from) {
      return;
    }

    const family = await this.families.findByChatId(String(ctx.chat.id));
    if (!family) {
      await ctx.reply('Este grupo ainda não foi configurado. Use /configurar.');
      return;
    }

    await this.users.upsertFromTelegram(ctx.from, family.id);
    await ctx.reply(`${ctx.from.first_name ?? 'Pronto'} entrou na família ${family.name}.`);
  }

  private async handleAddAdmins(ctx: Context): Promise<void> {
    if (!ctx.chat) {
      return;
    }

    const family = await this.families.findByChatId(String(ctx.chat.id));
    if (!family) {
      await ctx.reply('Use /configurar antes de adicionar administradores.');
      return;
    }

    const admins = await ctx.getChatAdministrators();
    let added = 0;

    for (const admin of admins) {
      if (admin.user.is_bot) {
        continue;
      }

      await this.users.upsertFromTelegram(admin.user, family.id);
      added += 1;
    }

    await ctx.reply(
      added === 0
        ? 'Não encontrei administradores para adicionar.'
        : `${added} administrador(es) agora podem registrar movimentações.`,
    );
  }

  private async handlePermissionChange(ctx: Context, data: string): Promise<void> {
    if (!ctx.chat) {
      return;
    }

    const family = await this.families.findByChatId(String(ctx.chat.id));
    if (!family) {
      await ctx.reply('Use /configurar antes de alterar permissões.');
      return;
    }

    const permission: TransactionPermission =
      data === 'family:perm:all'
        ? 'ALL_MEMBERS'
        : data === 'family:perm:admins'
          ? 'ADMINS_ONLY'
          : 'SELECTED_MEMBERS';

    const updated = await this.families.setPermission(family.id, permission);

    try {
      await ctx.editMessageText(this.buildConfigMessage(updated), {
        reply_markup: this.buildConfigKeyboard(),
      });
    } catch {
      await ctx.reply(this.buildConfigMessage(updated), {
        reply_markup: this.buildConfigKeyboard(),
      });
    }
  }

  private buildConfigMessage(family: FamilyWithUsers): string {
    const members =
      family.users.length === 0
        ? 'nenhum ainda'
        : family.users.map((member) => member.name).join(', ');

    return [
      '🏠 Vamos configurar esta família.',
      '',
      'Grupo:',
      family.name,
      '',
      'Quem pode registrar movimentações neste grupo?',
      this.permissionLabel(family.transactionPermission),
      '',
      `Membros: ${members}`,
    ].join('\n');
  }

  private buildConfigKeyboard() {
    return {
      inline_keyboard: [
        [{ text: 'Adicionar membros', callback_data: 'family:add_members' }],
        [
          { text: 'Todos', callback_data: 'family:perm:all' },
          { text: 'Só admins', callback_data: 'family:perm:admins' },
        ],
        [
          {
            text: 'Membros selecionados',
            callback_data: 'family:perm:selected',
          },
        ],
      ],
    };
  }

  private async dispatchSlashCommand(ctx: Context, text: string): Promise<void> {
    const parsed = parseSlashCommand(text);
    if (!parsed) {
      return;
    }

    switch (parsed.name) {
      case 'start':
        await this.handleStart(ctx);
        return;
      case 'ajuda':
      case 'help':
        await this.handleHelp(ctx);
        return;
      case 'ping':
        await this.handlePing(ctx);
        return;
      case 'configurar':
      case 'configuracoes':
        await this.handleConfigurar(ctx);
        return;
      case 'subcategorias':
        await this.handleSubcategorias(ctx);
        return;
      case 'categorias':
        await this.handleCategorias(ctx);
        return;
      case 'orcamento':
        await this.handleOrcamento(ctx, text);
        return;
      case 'limite':
      case 'limites':
        await this.handleLimite(ctx);
        return;
      case 'meta':
      case 'metas':
        await this.handleMeta(ctx);
        return;
      case 'cartao':
      case 'cartoes':
        await this.handleCartao(ctx);
        return;
      case 'fatura':
        await this.handlePayable(ctx);
        return;
      case 'contas':
        await this.handleContas(ctx);
        return;
      case 'resumo':
        await this.handleResumo(ctx);
        return;
      case 'previsao':
        await this.handlePrevisao(ctx);
        return;
      case 'extrato':
        await this.handleExtrato(ctx, text);
        return;
      case 'receita':
        await this.handleReceita(ctx);
        return;
      case 'despesa':
        await this.handleDespesa(ctx);
        return;
      case 'transferencia':
        await this.handleTransferencia(ctx);
        return;
      case 'recorrente':
      case 'recorrentes':
      case 'recorrencia':
      case 'recorrencias':
        await this.handleRecorrentes(ctx);
        return;
      case 'desfazer':
        await this.handleUndo(ctx);
        return;
      case 'auditoria':
        await this.handleAuditoria(ctx);
        return;
      case 'editar':
        await this.handleEditar(ctx);
        return;
      default:
        if (parsed.name.startsWith('recorrent')) {
          await this.handleRecorrentes(ctx);
          return;
        }
        await ctx.reply('Não reconheci esse comando. Use /ajuda.');
    }
  }

  private async ensureAuthorizedGroup(ctx: Context): Promise<boolean> {
    if (!ctx.chat) {
      return false;
    }

    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Só funciono no grupo autorizado da família.');
      return false;
    }

    const chatId = String(ctx.chat.id);
    if (!(await this.families.isChatAllowed(chatId))) {
      await ctx.reply(unauthorizedChatMessage(chatId));
      return false;
    }

    return true;
  }

  private permissionLabel(permission: TransactionPermission): string {
    if (permission === 'ALL_MEMBERS') {
      return 'Todos os membros do grupo';
    }
    if (permission === 'ADMINS_ONLY') {
      return 'Somente administradores';
    }
    return 'Somente membros adicionados';
  }

  private isGroupChat(ctx: Context): boolean {
    return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  }

  private getDocument(ctx: Context) {
    if (!ctx.message || !('document' in ctx.message)) {
      return undefined;
    }

    return ctx.message.document;
  }

  private isPdf(mimeType?: string, fileName?: string): boolean {
    return (
      mimeType === 'application/pdf' ||
      Boolean(fileName?.toLowerCase().endsWith('.pdf'))
    );
  }
}
