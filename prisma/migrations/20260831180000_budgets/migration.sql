CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budgets_family_id_category_id_key" ON "budgets"("family_id", "category_id");
CREATE INDEX "budgets_family_id_idx" ON "budgets"("family_id");
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
