CREATE INDEX IF NOT EXISTS "profiles_role_created_idx" ON "profiles" USING btree ("role","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "novels_updated_at_idx" ON "novels" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "novels_rating_count_idx" ON "novels" USING btree ("rating_count");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "novels_avg_rating_idx" ON "novels" USING btree ("avg_rating");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chapters_novel_published_number_idx" ON "chapters" USING btree ("novel_id","is_published","chapter_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ratings_novel_overall_idx" ON "ratings" USING btree ("novel_id","overall");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_category_flagged_pinned_updated_idx" ON "forum_posts" USING btree ("category_id","is_flagged","is_pinned","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_replies_post_flagged_created_idx" ON "forum_replies" USING btree ("post_id","is_flagged","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_created_idx" ON "reports" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reading_history_read_at_user_idx" ON "reading_history" USING btree ("read_at","user_id");
