CREATE TABLE "admin_uids" (
	"uid" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp (3) with time zone,
	"refresh_token_expires_at" timestamp (3) with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist" (
	"kind" text NOT NULL,
	"hash" text NOT NULL,
	"timestamp" bigint NOT NULL,
	CONSTRAINT "blocklist_kind_hash_pk" PRIMARY KEY("kind","hash")
);
--> statement-breakpoint
CREATE TABLE "configs" (
	"uid" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuration" (
	"id" text PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_entries" (
	"board" text NOT NULL,
	"period" bigint NOT NULL,
	"uid" text NOT NULL,
	"score" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "daily_entries_board_period_uid_pk" PRIMARY KEY("board","period","uid")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_bests" (
	"uid" text NOT NULL,
	"board" text NOT NULL,
	"wpm" double precision NOT NULL,
	"acc" double precision NOT NULL,
	"timestamp" bigint NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "leaderboard_bests_board_uid_pk" PRIMARY KEY("board","uid")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_generations" (
	"board" text PRIMARY KEY NOT NULL,
	"generation" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"entries" bigint
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"generation" text NOT NULL,
	"board" text NOT NULL,
	"uid" text NOT NULL,
	"rank" bigint NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "leaderboard_snapshots_generation_board_uid_pk" PRIMARY KEY("generation","board","uid")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"event" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutation_guards" (
	"id" text PRIMARY KEY NOT NULL,
	"valid" bigint NOT NULL,
	CONSTRAINT "mutation_version" CHECK ("mutation_guards"."valid" = 1)
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psas" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"tests_completed" bigint DEFAULT 0 NOT NULL,
	"tests_started" bigint DEFAULT 0 NOT NULL,
	"time_typing" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_ratings" (
	"id" text NOT NULL,
	"language" text NOT NULL,
	"quote_id" bigint NOT NULL,
	"ratings" bigint DEFAULT 0 NOT NULL,
	"total_rating" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "quote_ratings_language_quote_id_pk" PRIMARY KEY("language","quote_id")
);
--> statement-breakpoint
CREATE TABLE "quote_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"submitted_by" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"uid" text NOT NULL,
	"content_id" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "reports_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"mode" text NOT NULL,
	"mode2" text NOT NULL,
	"language" text NOT NULL,
	"wpm" double precision NOT NULL,
	"acc" double precision NOT NULL,
	"client" text DEFAULT 'web' NOT NULL,
	"submission_hash" text,
	"data" jsonb NOT NULL,
	CONSTRAINT "results_client" CHECK ("results"."client" = 'web')
);
--> statement-breakpoint
CREATE TABLE "speed_histograms" (
	"board" text NOT NULL,
	"bucket" text NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "speed_histograms_board_bucket_pk" PRIMARY KEY("board","bucket")
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"uid" text NOT NULL,
	"client" text DEFAULT 'web' NOT NULL,
	"day" bigint NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "user_activity_uid_client_day_pk" PRIMARY KEY("uid","client","day")
);
--> statement-breakpoint
CREATE TABLE "user_quote_ratings" (
	"uid" text NOT NULL,
	"language" text NOT NULL,
	"quote_id" bigint NOT NULL,
	"rating" double precision NOT NULL,
	CONSTRAINT "user_quote_ratings_uid_language_quote_id_pk" PRIMARY KEY("uid","language","quote_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"uid" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"email" text NOT NULL,
	"added_at" bigint NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	"time_typing" double precision DEFAULT 0 NOT NULL,
	"completed_tests" bigint DEFAULT 0 NOT NULL,
	"started_tests" bigint DEFAULT 0 NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"lb_opt_out" boolean DEFAULT false NOT NULL,
	"needs_to_change_name" boolean DEFAULT false NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "users_id_unique" UNIQUE("id"),
	CONSTRAINT "users_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "weekly_entries" (
	"period" bigint NOT NULL,
	"uid" text NOT NULL,
	"client" text DEFAULT 'web' NOT NULL,
	"xp" bigint NOT NULL,
	"time_typed_seconds" double precision NOT NULL,
	"expires_at" bigint NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "weekly_entries_client_period_uid_pk" PRIMARY KEY("client","period","uid")
);
--> statement-breakpoint
CREATE TABLE "write_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configs" ADD CONSTRAINT "configs_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_bests" ADD CONSTRAINT "leaderboard_bests_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quote_ratings" ADD CONSTRAINT "user_quote_ratings_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_entries" ADD CONSTRAINT "weekly_entries_uid_users_uid_fk" FOREIGN KEY ("uid") REFERENCES "public"."users"("uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_idx" ON "auth_accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_verifications_expiry_idx" ON "auth_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "daily_entries_rank_idx" ON "daily_entries" USING btree ("board","period","score","uid");--> statement-breakpoint
CREATE INDEX "daily_entries_summary_idx" ON "daily_entries" USING btree ("board","period",(("data"->>'wpm')::double precision));--> statement-breakpoint
CREATE INDEX "daily_entries_expiry_idx" ON "daily_entries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "daily_entries_owner_idx" ON "daily_entries" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "leaderboard_bests_score_idx" ON "leaderboard_bests" USING btree ("board","wpm","acc","timestamp");--> statement-breakpoint
CREATE INDEX "leaderboard_bests_owner_idx" ON "leaderboard_bests" USING btree ("uid");--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_snapshots_rank_idx" ON "leaderboard_snapshots" USING btree ("generation","board","rank");--> statement-breakpoint
CREATE INDEX "leaderboard_snapshots_owner_idx" ON "leaderboard_snapshots" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "audit_logs_owner_idx" ON "audit_logs" USING btree ("uid","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_retention_idx" ON "audit_logs" USING btree ("important","timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_event_idx" ON "audit_logs" USING btree ("event","timestamp");--> statement-breakpoint
CREATE INDEX "presets_owner_idx" ON "presets" USING btree ("uid","timestamp");--> statement-breakpoint
CREATE INDEX "quote_submissions_review_idx" ON "quote_submissions" USING btree ("approved","language","timestamp");--> statement-breakpoint
CREATE INDEX "reports_content_idx" ON "reports" USING btree ("content_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_idx" ON "reports" USING btree ("content_id","uid");--> statement-breakpoint
CREATE INDEX "results_client_time_idx" ON "results" USING btree ("uid","client","timestamp","id");--> statement-breakpoint
CREATE UNIQUE INDEX "results_submission_idx" ON "results" USING btree ("uid","submission_hash");--> statement-breakpoint
CREATE INDEX "weekly_entries_rank_idx" ON "weekly_entries" USING btree ("client","period","xp","uid");--> statement-breakpoint
CREATE INDEX "weekly_entries_expiry_idx" ON "weekly_entries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "weekly_entries_owner_idx" ON "weekly_entries" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "write_receipts_created_idx" ON "write_receipts" USING btree ("created_at");