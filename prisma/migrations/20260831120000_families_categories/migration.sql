-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "TransactionPermission" AS ENUM ('ALL_MEMBERS', 'ADMINS_ONLY', 'SELECTED_MEMBERS');
CREATE TYPE "CategorizationSource" AS ENUM ('RULE', 'HISTORY', 'AI', 'MANUAL');

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegram_chat_id" TEXT NOT NULL,
    "transaction_permission" "TransactionPermission" NOT NULL DEFAULT 'SELECTED_MEMBERS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "families_telegram_chat_id_key" ON "families"("telegram_chat_id");

-- AlterTable users
ALTER INDEX "users_telegram_id_key" RENAME TO "users_telegram_user_id_key";
ALTER TABLE "users" RENAME COLUMN "telegram_id" TO "telegram_user_id";
ALTER TABLE "users" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
UPDATE "users"
SET "name" = COALESCE(
  NULLIF(TRIM(CONCAT(COALESCE("first_name", ''), ' ', COALESCE("last_name", ''))), ''),
  "username",
  "telegram_user_id"
);
ALTER TABLE "users" DROP COLUMN "first_name";
ALTER TABLE "users" DROP COLUMN "last_name";
ALTER TABLE "users" ADD COLUMN "family_id" TEXT;
CREATE INDEX "users_family_id_idx" ON "users"("family_id");
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "family_id" TEXT,
    "pattern" TEXT NOT NULL,
    "merchant" TEXT,
    "category_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "category_rules_family_id_idx" ON "category_rules"("family_id");
CREATE INDEX "category_rules_category_id_idx" ON "category_rules"("category_id");
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "raw_text" TEXT,
    "category_id" TEXT NOT NULL,
    "source" "CategorizationSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transactions_family_id_idx" ON "transactions"("family_id");
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");
CREATE INDEX "transactions_merchant_idx" ON "transactions"("merchant");
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
