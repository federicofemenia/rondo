-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "duration_minutes" INTEGER NOT NULL DEFAULT 60;

-- Backfill: existing matches get the duration their sport modality already
-- used to compute endsAt with, instead of silently defaulting every one of
-- them (including e.g. 90-minute padel matches) to 60.
UPDATE "matches" AS m
SET "duration_minutes" = sm.duration_minutes
FROM "sport_modalities" AS sm
WHERE m.sport_modality_id = sm.id;
