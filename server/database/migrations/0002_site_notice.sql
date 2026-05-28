CREATE TABLE IF NOT EXISTS "site_notice" (
	"id" text PRIMARY KEY NOT NULL DEFAULT 'homepage-popup',
	"message" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
