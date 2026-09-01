-- CreateEnum
CREATE TYPE "TransactionHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "transactions_deleted_at_idx" ON "transactions"("deleted_at");

-- CreateTable
CREATE TABLE "transaction_history" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "action" "TransactionHistoryAction" NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_history_transaction_id_idx" ON "transaction_history"("transaction_id");
CREATE INDEX "transaction_history_family_id_idx" ON "transaction_history"("family_id");
CREATE INDEX "transaction_history_changed_by_id_idx" ON "transaction_history"("changed_by_id");
CREATE INDEX "transaction_history_created_at_idx" ON "transaction_history"("created_at");

ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
