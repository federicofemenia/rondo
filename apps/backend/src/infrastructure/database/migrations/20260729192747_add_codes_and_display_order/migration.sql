-- AlterTable: add new columns as nullable first so existing rows can be backfilled safely.
ALTER TABLE "clubs" ADD COLUMN     "code" TEXT;

ALTER TABLE "courts" ADD COLUMN     "code" TEXT,
ADD COLUMN     "display_order" INTEGER;

ALTER TABLE "sport_modalities" ADD COLUMN     "code" TEXT,
ADD COLUMN     "display_order" INTEGER;

ALTER TABLE "sports" ADD COLUMN     "display_order" INTEGER;

-- Backfill existing development data with stable, readable codes and display order.
UPDATE "clubs" SET "code" = 'senor-pato' WHERE "id" = '00000000-0000-0000-0000-000000000021';

UPDATE "sports" SET "display_order" = 1 WHERE "id" = '00000000-0000-0000-0000-000000000002';
UPDATE "sports" SET "display_order" = 2 WHERE "id" = '00000000-0000-0000-0000-000000000001';

UPDATE "sport_modalities" SET "code" = 'football-5', "display_order" = 1 WHERE "id" = '00000000-0000-0000-0000-000000000012';
UPDATE "sport_modalities" SET "code" = 'padel-doubles', "display_order" = 1 WHERE "id" = '00000000-0000-0000-0000-000000000011';

UPDATE "courts" SET "code" = 'padel-1', "display_order" = 1 WHERE "id" = '00000000-0000-0000-0000-000000000031';
UPDATE "courts" SET "code" = 'padel-2', "display_order" = 2 WHERE "id" = '00000000-0000-0000-0000-000000000032';
UPDATE "courts" SET "code" = 'padel-3', "display_order" = 3 WHERE "id" = '00000000-0000-0000-0000-000000000033';
UPDATE "courts" SET "code" = 'football-5', "display_order" = 4 WHERE "id" = '00000000-0000-0000-0000-000000000034';

-- Any row not covered by the backfill above (e.g. rows created ad hoc outside the seed) still needs a
-- deterministic, unique value so the columns below can become NOT NULL.
UPDATE "clubs" SET "code" = 'club-' || "id" WHERE "code" IS NULL;
UPDATE "sports" SET "display_order" = 999 WHERE "display_order" IS NULL;
UPDATE "sport_modalities" SET "code" = 'modality-' || "id", "display_order" = 999 WHERE "code" IS NULL OR "display_order" IS NULL;
UPDATE "courts" SET "code" = 'court-' || "id", "display_order" = 999 WHERE "code" IS NULL OR "display_order" IS NULL;

-- AlterTable: now that every row has a value, the columns can be made required.
ALTER TABLE "clubs" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "courts" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "display_order" SET NOT NULL;
ALTER TABLE "sport_modalities" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "display_order" SET NOT NULL;
ALTER TABLE "sports" ALTER COLUMN "display_order" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clubs_code_key" ON "clubs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courts_club_id_code_key" ON "courts"("club_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sport_modalities_code_key" ON "sport_modalities"("code");
