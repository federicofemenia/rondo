-- AlterTable: add the new scheduling columns as nullable first so existing
-- rows can be backfilled before the NOT NULL constraint is enforced.
ALTER TABLE "matches" ADD COLUMN     "availability_end_minutes" INTEGER,
ADD COLUMN     "availability_start_minutes" INTEGER,
ADD COLUMN     "scheduled_date" DATE;

ALTER TABLE "sport_modalities" ADD COLUMN     "duration_minutes" INTEGER;

-- Backfill existing sport modalities with the same durations already used by
-- their courts' slotDurationMinutes in the seed data.
UPDATE "sport_modalities" SET "duration_minutes" = 60 WHERE "duration_minutes" IS NULL;

-- Backfill existing matches: scheduledDate from starts_at (or created_at when
-- unset), and an availability window padded an hour around the existing
-- starts_at/ends_at so it remains a valid superset of them.
UPDATE "matches" SET
  "scheduled_date" = COALESCE("starts_at", "created_at")::date,
  "availability_start_minutes" = GREATEST(
    0,
    COALESCE(EXTRACT(HOUR FROM "starts_at")::int * 60 + EXTRACT(MINUTE FROM "starts_at")::int, 600) - 60
  ),
  "availability_end_minutes" = LEAST(
    1440,
    COALESCE(EXTRACT(HOUR FROM "ends_at")::int * 60 + EXTRACT(MINUTE FROM "ends_at")::int, 1320) + 60
  )
WHERE "scheduled_date" IS NULL;

-- Safety net in case the padded window ever collapsed (e.g. missing dates).
UPDATE "matches" SET "availability_end_minutes" = "availability_start_minutes" + 60
WHERE "availability_end_minutes" <= "availability_start_minutes";

ALTER TABLE "matches" ALTER COLUMN "scheduled_date" SET NOT NULL,
ALTER COLUMN "availability_start_minutes" SET NOT NULL,
ALTER COLUMN "availability_end_minutes" SET NOT NULL;

ALTER TABLE "sport_modalities" ALTER COLUMN "duration_minutes" SET NOT NULL;

-- CreateIndex
CREATE INDEX "matches_scheduled_date_idx" ON "matches"("scheduled_date");
