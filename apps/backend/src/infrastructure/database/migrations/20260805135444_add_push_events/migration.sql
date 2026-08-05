-- CreateEnum
CREATE TYPE "PushEventType" AS ENUM ('MATCH_INVITATION_RECEIVED', 'MATCH_INVITATION_ACCEPTED', 'MATCH_INVITATION_REJECTED', 'MATCH_PARTICIPANT_JOINED', 'MATCH_FULL', 'MATCH_CANCELLED', 'MATCH_COMPLETED_RATINGS_ENABLED', 'MATCH_CHAT_MESSAGE');

-- CreateTable
CREATE TABLE "push_events" (
    "id" TEXT NOT NULL,
    "type" "PushEventType" NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "push_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_events_dedupe_key_key" ON "push_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "push_events_aggregate_id_idx" ON "push_events"("aggregate_id");

-- CreateIndex
CREATE INDEX "push_events_processed_at_created_at_idx" ON "push_events"("processed_at", "created_at");
