CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cards_family_id_name_key" ON "cards"("family_id", "name");
ALTER TABLE "cards" ADD CONSTRAINT "cards_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT,
    "category_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "raw_text" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "installment_amount" DECIMAL(12,2) NOT NULL,
    "source" "CategorizationSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "installment_plans_family_id_idx" ON "installment_plans"("family_id");
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_month" INTEGER NOT NULL,
    "reference_year" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "installments_transaction_id_key" ON "installments"("transaction_id");
CREATE UNIQUE INDEX "installments_plan_id_number_key" ON "installments"("plan_id", "number");
CREATE INDEX "installments_reference_year_reference_month_status_idx" ON "installments"("reference_year", "reference_month", "status");
ALTER TABLE "installments" ADD CONSTRAINT "installments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installments" ADD CONSTRAINT "installments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
