-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add password_hash, backfill, then require it
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- Backfill: existing rows were identified by Clerk, never had a Rondo
-- password. This sentinel is never a valid Argon2id hash (verify() always
-- fails against it), so these accounts become permanently unable to log in
-- through the new flow without deleting any of their historical data (their
-- matches, ratings, chat messages, etc. all stay intact). Actual deletion of
-- these now-orphaned rows is handled separately by the guarded
-- beta:reset-user-data script, never automatically by a migration.
UPDATE "users" SET "password_hash" = 'MIGRATED_NO_PASSWORD_' || "id" WHERE "password_hash" IS NULL;

ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

-- Backfill: username was optional under Clerk (identity lived in
-- clerk_user_id); it becomes the sole unique identity anchor going forward,
-- so any legacy row without one gets a deterministic, collision-safe
-- placeholder derived from its id (the full id, not a prefix -- this
-- codebase's deterministic seed/test fixture ids share a common prefix,
-- e.g. 00000000-0000-0000-0000-0000000000XX, so a short prefix alone
-- would collide).
UPDATE "users" SET "username" = 'legacy_' || replace("id"::text, '-', '') WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- DropIndex
DROP INDEX "users_clerk_user_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clerk_user_id";
