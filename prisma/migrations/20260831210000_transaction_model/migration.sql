-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('TEXT', 'PHOTO', 'PDF', 'MANUAL', 'IMPORT');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REFUND';

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_family_id_name_key" ON "accounts"("family_id", "name");
CREATE INDEX "accounts_family_id_idx" ON "accounts"("family_id");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "transaction_date" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "subcategory_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "account_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "source_document_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN "categorization_source" "CategorizationSource";
ALTER TABLE "transactions" ADD COLUMN "origin" "TransactionSource";

UPDATE "transactions" SET "categorization_source" = "source";
UPDATE "transactions" SET "transaction_date" = "created_at";
UPDATE "transactions" SET "origin" = 'TEXT';
UPDATE "transactions" SET "origin" = 'PHOTO' WHERE "raw_text" ILIKE 'comprovante%';
UPDATE "transactions" SET "origin" = 'IMPORT' WHERE "raw_text" ILIKE 'fatura%';
UPDATE "transactions" SET "origin" = 'PDF' WHERE "raw_text" ILIKE 'conta %';
UPDATE "transactions" SET "confidence" = CASE "categorization_source"
    WHEN 'MANUAL' THEN 1
    WHEN 'AI' THEN 0.7
    ELSE 0.9
END;

UPDATE "transactions" AS t
SET "subcategory_id" = t."category_id",
    "category_id" = c."parent_id"
FROM "categories" AS c
WHERE t."category_id" = c."id"
  AND c."parent_id" IS NOT NULL;

ALTER TABLE "transactions" ALTER COLUMN "categorization_source" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "transaction_date" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "origin" SET NOT NULL;

ALTER TABLE "transactions" DROP COLUMN "source";
ALTER TABLE "transactions" RENAME COLUMN "origin" TO "source";

ALTER TABLE "transactions" RENAME COLUMN "card_id" TO "credit_card_id";
ALTER INDEX "transactions_card_id_idx" RENAME TO "transactions_credit_card_id_idx";
ALTER TABLE "transactions" RENAME CONSTRAINT "transactions_card_id_fkey" TO "transactions_credit_card_id_fkey";

CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");
CREATE INDEX "transactions_subcategory_id_idx" ON "transactions"("subcategory_id");
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");
CREATE INDEX "transactions_source_document_id_idx" ON "transactions"("source_document_id");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
