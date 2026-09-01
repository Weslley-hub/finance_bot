-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'BANK_RECEIPT', 'BILL', 'INVOICE', 'BANK_STATEMENT', 'UNKNOWN');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSED', 'REVIEW', 'FAILED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "type" "DocumentType";
ALTER TABLE "documents" ADD COLUMN "storage_path" TEXT;
ALTER TABLE "documents" ADD COLUMN "extracted_text" TEXT;
ALTER TABLE "documents" ADD COLUMN "parsed_data" JSONB;
ALTER TABLE "documents" ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'PROCESSED';

UPDATE "documents" SET "parsed_data" = "extracted_json";

UPDATE "documents" SET "type" = CASE
  WHEN "extracted_json"->>'kind' = 'CARD_INVOICE' THEN 'INVOICE'::"DocumentType"
  WHEN "kind"::text = 'BILL' THEN 'BILL'::"DocumentType"
  WHEN "kind"::text = 'RECEIPT' AND COALESCE("extracted_json"->>'paymentType', '') IN ('PIX', 'TED', 'TRANSFER') THEN 'BANK_RECEIPT'::"DocumentType"
  WHEN "kind"::text = 'RECEIPT' THEN 'RECEIPT'::"DocumentType"
  ELSE 'UNKNOWN'::"DocumentType"
END;

ALTER TABLE "documents" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "documents" DROP COLUMN "kind";
ALTER TABLE "documents" DROP COLUMN "extracted_json";

DROP TYPE "DocumentKind";

CREATE INDEX "documents_family_id_type_idx" ON "documents"("family_id", "type");
CREATE INDEX "documents_status_idx" ON "documents"("status");
