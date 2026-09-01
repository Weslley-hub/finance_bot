ALTER TABLE "cards" ADD COLUMN "credit_limit" DECIMAL(12,2);
ALTER TABLE "cards" ADD COLUMN "closing_day" INTEGER;
ALTER TABLE "cards" ADD COLUMN "due_day" INTEGER;

CREATE TABLE "card_invoices" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_invoices_card_id_reference_month_reference_year_key" ON "card_invoices"("card_id", "reference_month", "reference_year");
CREATE INDEX "card_invoices_family_id_status_idx" ON "card_invoices"("family_id", "status");
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD COLUMN "card_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "card_invoice_id" TEXT;
CREATE INDEX "transactions_card_id_idx" ON "transactions"("card_id");
CREATE INDEX "transactions_card_invoice_id_idx" ON "transactions"("card_invoice_id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_invoice_id_fkey" FOREIGN KEY ("card_invoice_id") REFERENCES "card_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
