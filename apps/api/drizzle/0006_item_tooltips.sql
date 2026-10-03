CREATE TABLE "item_tooltips" (
	"flavour" text NOT NULL,
	"region" text NOT NULL,
	"item_id" integer NOT NULL,
	"tooltip" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "item_tooltips_key" ON "item_tooltips" USING btree ("region","flavour","item_id");