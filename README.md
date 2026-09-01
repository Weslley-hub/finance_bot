# Finlar Bot API

Backend NestJS do assistente financeiro **Finlar**. A API recebe atualizações do Telegram, persiste dados no PostgreSQL (Prisma) e se integra com a OpenAI.

## Pré-requisitos

- Node.js 20
- Docker e Docker Compose
- Token do bot no Telegram (BotFather)
- Chave da OpenAI (quando for usar IA)

## FIN-010 — Criar o bot no BotFather

Isso precisa ser feito na sua conta do Telegram (não dá para automatizar daqui):

1. Abra o Telegram e converse com [@BotFather](https://t.me/BotFather).
2. Envie `/newbot`.
3. Escolha um nome (ex.: `Finlar`) e um username que termine com `bot` (ex.: `finlar_assistente_bot`).
4. Copie o token gerado.
5. Cole no arquivo `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AA...seu_token
```

Nunca coloque o token no código-fonte.

## Configuração

```bash
cp .env.example .env
```

Variáveis:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL (local: porta 5433) |
| `TELEGRAM_BOT_TOKEN` | Token do BotFather |
| `OPENAI_API_KEY` | Chave da OpenAI |
| `PORT` | Porta HTTP (padrão local 3001) |

## Subir com Docker

Na pasta `finlar-bot-api`:

```bash
docker compose up --build
```

Sobe PostgreSQL na porta `5433` (a `5432` do host já estava em uso) e a API na porta `3001` (a `3000` do host já estava em uso).

- Health: http://localhost:3001/health
- Swagger: http://localhost:3001/docs

## Desenvolvimento local

Com o Postgres no Docker:

```bash
docker compose up postgres -d
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

## Telegram (FIN-011)

O módulo `src/telegram` já trata:

- mensagem de texto
- foto
- documento
- PDF
- comandos (`/start`, `/help`, `/ping`)
- callback de botão inline

Sem `TELEGRAM_BOT_TOKEN` válido, a API sobe normalmente e o polling do bot fica desligado.

## Estrutura

```
src/
├── telegram/
├── users/
├── families/
├── transactions/
├── categories/
├── accounts/
├── cards/
├── bills/
├── recurring/
├── budgets/
├── reports/
├── documents/
├── ai/
├── notifications/
└── common/
```
