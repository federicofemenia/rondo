-- CreateEnum
CREATE TYPE "MatchInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "match_invitations" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "invited_user_id" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "position" TEXT,
    "status" "MatchInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_invitations_match_id_idx" ON "match_invitations"("match_id");

-- CreateIndex
CREATE INDEX "match_invitations_invited_user_id_idx" ON "match_invitations"("invited_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_invitations_match_id_invited_user_id_key" ON "match_invitations"("match_id", "invited_user_id");

-- AddForeignKey
ALTER TABLE "match_invitations" ADD CONSTRAINT "match_invitations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_invitations" ADD CONSTRAINT "match_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_invitations" ADD CONSTRAINT "match_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
