import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "@/db/local";

// Apply generated migrations (drizzle/) to the Postgres at DATABASE_URL.
const url = databaseUrl();
const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await sql.end();
console.log(`Migrations applied to ${url.replace(/:[^:@/]+@/, ":****@")}`);
