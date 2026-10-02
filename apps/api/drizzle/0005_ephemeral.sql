CREATE TABLE "ephemeral" (
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ephemeral_kind_key_pk" PRIMARY KEY("kind","key")
);
--> statement-breakpoint
CREATE INDEX "ephemeral_expiry" ON "ephemeral" USING btree ("expires_at");