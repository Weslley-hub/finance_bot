import { Action, Command, Ctx, Help, On, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramService } from './telegram.service';

@Update()
export class TelegramUpdate {
  constructor(private readonly telegramService: TelegramService) {}

  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleStart(ctx);
  }

  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleHelp(ctx);
  }

  @Command('ajuda')
  async onAjuda(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleHelp(ctx);
  }

  @Command('ping')
  async onPing(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handlePing(ctx);
  }

  @Command('configurar')
  async onConfigurar(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleConfigurar(ctx);
  }

  @Command('configuracoes')
  async onConfiguracoes(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleConfigurar(ctx);
  }

  @Command('subcategorias')
  async onSubcategorias(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleSubcategorias(ctx);
  }

  @Command('categorias')
  async onCategorias(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleCategorias(ctx);
  }

  @Command('orcamento')
  async onOrcamento(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleOrcamento(ctx);
  }

  @Command('limite')
  async onLimite(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleLimite(ctx);
  }

  @Command('limites')
  async onLimites(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleLimite(ctx);
  }

  @Command('meta')
  async onMeta(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleMeta(ctx);
  }

  @Command('metas')
  async onMetas(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleMeta(ctx);
  }

  @Command('cartao')
  async onCartao(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleCartao(ctx);
  }

  @Command('cartoes')
  async onCartoes(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleCartao(ctx);
  }

  @Command('fatura')
  async onFatura(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handlePayable(ctx);
  }

  @Command('contas')
  async onContas(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleContas(ctx);
  }

  @Command('resumo')
  async onResumo(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleResumo(ctx);
  }

  @Command('previsao')
  async onPrevisao(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handlePrevisao(ctx);
  }

  @Command('extrato')
  async onExtrato(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleExtrato(ctx);
  }

  @Command('receita')
  async onReceita(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleReceita(ctx);
  }

  @Command('despesa')
  async onDespesa(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleDespesa(ctx);
  }

  @Command('transferencia')
  async onTransferencia(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleTransferencia(ctx);
  }

  @Command('recorrente')
  async onRecorrente(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleRecorrentes(ctx);
  }

  @Command('recorrentes')
  async onRecorrentes(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleRecorrentes(ctx);
  }

  @Command('recorrencia')
  async onRecorrencia(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleRecorrentes(ctx);
  }

  @Command('recorrencias')
  async onRecorrencias(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleRecorrentes(ctx);
  }

  @Command('desfazer')
  async onDesfazer(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleUndo(ctx);
  }

  @Command('auditoria')
  async onAuditoria(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleAuditoria(ctx);
  }

  @Command('editar')
  async onEditar(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleEditar(ctx);
  }

  @On('new_chat_members')
  async onNewChatMembers(@Ctx() ctx: Context): Promise<void> {
    if (!ctx.message || !('new_chat_members' in ctx.message)) {
      return;
    }

    const botId = ctx.botInfo?.id;
    const added = ctx.message.new_chat_members.some((member) => member.id === botId);
    if (added) {
      await this.telegramService.handleBotAddedToGroup(ctx);
    }
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: Context): Promise<void> {
    const update = ctx.myChatMember;
    if (!update) {
      return;
    }

    const becameMember = ['member', 'administrator'].includes(
      update.new_chat_member.status,
    );
    const wasAway = ['left', 'kicked'].includes(update.old_chat_member.status);

    if (becameMember && wasAway) {
      await this.telegramService.handleBotAddedToGroup(ctx);
    }
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handlePhoto(ctx);
  }

  @On('document')
  async onDocument(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleDocument(ctx);
  }

  @On('text')
  async onText(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleText(ctx);
  }

  @Action(/.+/)
  async onCallback(@Ctx() ctx: Context): Promise<void> {
    await this.telegramService.handleCallback(ctx);
  }
}
