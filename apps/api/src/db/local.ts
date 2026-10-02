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
  const serverless = !!process.env.VERCEL;
  const sql = postgres(url, {
    onnotice: () => {},
    // Supabase's transaction pooler (port 6543) can't keep prepared statements.
    prepare: !/:6543\//.test(url),
    // A serverless instance needs few connections and must let them go fast.
    ...(serverless ? { max: 3, idle_timeout: 20, connect_timeout: 10 } : {}),
  });
  setDb(drizzle(sql, { schema }) as unknown as DB);
  return sql;
}
