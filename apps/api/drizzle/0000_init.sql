CREATE TABLE "character_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"flavour" text NOT NULL,
	"realm_slug" text NOT NULL,
	"realm_name" text NOT NULL,
	"name_key" text NOT NULL,
	"name" text NOT NULL,
	"blizzard_id" integer,
	"level" integer DEFAULT 0 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"race" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"class_key" text,
	"gender" text DEFAULT '' NOT NULL,
	"faction" text DEFAULT 'neutral' NOT NULL,
	"guild" text,
	"is_ghost" boolean DEFAULT false NOT NULL,
	"is_self_found" boolean DEFAULT false NOT NULL,
	"item_level" integer,
	"avatar_url" text,
	"render_url" text,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"talents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb,
	"last_login_at" timestamp with time zone,
	"dead_at" timestamp with time zone,
	"status" text DEFAULT 'ok' NOT NULL,
	"fetched_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_icons" (
	"flavour" text NOT NULL,
	"region" text NOT NULL,
	"item_id" integer NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_id" text NOT NULL,
	"character_ids" integer[] NOT NULL,
	"events" text[] NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_events" ADD CONSTRAINT "character_events_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_character" ON "character_events" USING btree ("character_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_identity" ON "characters" USING btree ("region","flavour","realm_slug","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "item_icons_key" ON "item_icons" USING btree ("region","flavour","item_id");