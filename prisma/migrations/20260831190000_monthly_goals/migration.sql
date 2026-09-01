CREATE TABLE "monthly_goals" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_goals_family_id_key" ON "monthly_goals"("family_id");
ALTER TABLE "monthly_goals" ADD CONSTRAINT "monthly_goals_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
