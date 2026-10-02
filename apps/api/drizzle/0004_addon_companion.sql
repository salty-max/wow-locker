CREATE TABLE "companion_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"region" text NOT NULL,
	"battletag" text,
	"owned_ids" integer[] NOT NULL,
	"owned" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_upload_at" timestamp with time zone,
	CONSTRAINT "companion_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "character_events" ADD COLUMN "source" text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "character_events" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "addon" jsonb;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_key" ON "reminders" USING btree ("character_id","kind","key");--> statement-breakpoint
CREATE INDEX "reminders_due" ON "reminders" USING btree ("sent_at","fire_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe" ON "character_events" USING btree ("character_id","dedupe_key");