-- CreateTable
CREATE TABLE "user_sport_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sport_id" TEXT NOT NULL,
    "positions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_available_for_invitations" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sport_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_availabilities" (
    "id" TEXT NOT NULL,
    "user_sport_profile_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sport_profiles_user_id_idx" ON "user_sport_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_sport_profiles_sport_id_idx" ON "user_sport_profiles"("sport_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sport_profiles_user_id_sport_id_key" ON "user_sport_profiles"("user_id", "sport_id");

-- CreateIndex
CREATE INDEX "player_availabilities_user_sport_profile_id_idx" ON "player_availabilities"("user_sport_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_availabilities_user_sport_profile_id_day_of_week_sta_key" ON "player_availabilities"("user_sport_profile_id", "day_of_week", "start_minutes", "end_minutes");

-- AddForeignKey
ALTER TABLE "user_sport_profiles" ADD CONSTRAINT "user_sport_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sport_profiles" ADD CONSTRAINT "user_sport_profiles_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_availabilities" ADD CONSTRAINT "player_availabilities_user_sport_profile_id_fkey" FOREIGN KEY ("user_sport_profile_id") REFERENCES "user_sport_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
