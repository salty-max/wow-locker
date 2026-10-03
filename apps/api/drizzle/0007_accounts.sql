CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bnet_id" bigint NOT NULL,
	"battletag" text,
	"owned" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"roster" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"lang" text,
	"events" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_bnet_id_unique" UNIQUE("bnet_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_links" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_account" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_links" ADD CONSTRAINT "companion_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;