-- CreateEnum
CREATE TYPE "MatchVenueType" AS ENUM ('CLUB', 'TO_BE_DEFINED', 'CUSTOM');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "custom_venue_name" TEXT,
ADD COLUMN     "venue_type" "MatchVenueType" NOT NULL DEFAULT 'TO_BE_DEFINED';

-- Backfill: matches that already had a club selected must be classified as
-- CLUB, not TO_BE_DEFINED (the column default only applies to genuinely
-- undecided matches, not to pre-existing rows that already have a club_id).
UPDATE "matches" SET "venue_type" = 'CLUB' WHERE "club_id" IS NOT NULL;
