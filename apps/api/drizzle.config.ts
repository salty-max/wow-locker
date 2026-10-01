import { defineConfig } from "drizzle-kit";

// Postgres. `db:generate` emits migrations from the schema; apply them with
// `db:migrate` against DATABASE_URL.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://wowlocker:wowlocker@localhost:5434/wowlocker",
  },
  verbose: true,
  strict: true,
});
