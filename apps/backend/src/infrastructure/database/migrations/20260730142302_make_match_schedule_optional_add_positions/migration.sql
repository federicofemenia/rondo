-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "positions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "starts_at" DROP NOT NULL,
ALTER COLUMN "ends_at" DROP NOT NULL;
