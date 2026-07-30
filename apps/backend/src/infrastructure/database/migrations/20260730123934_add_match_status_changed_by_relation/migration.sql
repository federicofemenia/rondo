-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_status_changed_by_user_id_fkey" FOREIGN KEY ("status_changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
