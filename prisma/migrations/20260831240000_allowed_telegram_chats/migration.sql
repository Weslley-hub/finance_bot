CREATE TABLE "allowed_telegram_chats" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "label" TEXT,
    "family_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_telegram_chats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allowed_telegram_chats_chat_id_key" ON "allowed_telegram_chats"("chat_id");

ALTER TABLE "allowed_telegram_chats" ADD CONSTRAINT "allowed_telegram_chats_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "allowed_telegram_chats" ("id", "chat_id", "label", "family_id")
SELECT "id", "telegram_chat_id", "name", "id"
FROM "families"
ON CONFLICT ("chat_id") DO NOTHING;
