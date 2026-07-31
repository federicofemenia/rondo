-- CreateTable
CREATE TABLE "match_chat_messages" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_chat_messages_match_id_created_at_idx" ON "match_chat_messages"("match_id", "created_at");

-- AddForeignKey
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_chat_messages" ADD CONSTRAINT "match_chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
