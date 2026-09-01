-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_bills_family_id_active_idx" ON "recurring_bills"("family_id", "active");
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bills" ADD COLUMN "recurring_bill_id" TEXT;
CREATE UNIQUE INDEX "bills_recurring_bill_id_reference_month_reference_year_key" ON "bills"("recurring_bill_id", "reference_month", "reference_year");
ALTER TABLE "bills" ADD CONSTRAINT "bills_recurring_bill_id_fkey" FOREIGN KEY ("recurring_bill_id") REFERENCES "recurring_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
