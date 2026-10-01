import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setDb, schema, type DB } from "@/db";

// The process's Postgres connection, from DATABASE_URL (local `bun run db`
// container by default, the Northflank addon in prod).

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgres://wowlocker:wowlocker@localhost:5434/wowlocker";
}

/** Open a connection and register it as the app's db. Returns the raw client
 *  so scripts can `await sql.end()` and let the process exit. */
export function initDb(url = databaseUrl()): ReturnType<typeof postgres> {
  const sql = postgres(url, { onnotice: () => {} });
  setDb(drizzle(sql, { schema }) as unknown as DB);
  return sql;
}
