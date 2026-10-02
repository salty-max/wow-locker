import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "@/db/local";

// Apply generated migrations (drizzle/) to the Postgres at MIGRATE_URL, or
// DATABASE_URL. On Supabase, MIGRATE_URL is the session pooler (port 5432):
// migrations need a real session, which the transaction pooler isn't.
const url = process.env.MIGRATE_URL || databaseUrl();
const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await sql.end();
console.log(`Migrations applied to ${url.replace(/:[^:@/]+@/, ":****@")}`);
