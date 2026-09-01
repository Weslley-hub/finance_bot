-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('RECEIPT', 'BILL', 'OTHER');
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_file_id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "extracted_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documents_family_id_idx" ON "documents"("family_id");
ALTER TABLE "documents" ADD CONSTRAINT "documents_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "barcode" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "document_id" TEXT,
    "paid_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bills_paid_transaction_id_key" ON "bills"("paid_transaction_id");
CREATE INDEX "bills_family_id_status_idx" ON "bills"("family_id", "status");
CREATE INDEX "bills_due_date_idx" ON "bills"("due_date");
ALTER TABLE "bills" ADD CONSTRAINT "bills_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_paid_transaction_id_fkey" FOREIGN KEY ("paid_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
