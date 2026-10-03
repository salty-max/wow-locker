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

// Lockdown, after every migration run (so new tables are covered too).
// Supabase also serves the public schema over its REST API to its `anon` and
// `authenticated` roles. The app never uses that API: it connects as the
// tables' owner, which row-level security doesn't apply to. So RLS on with no
// policy (nobody else reads a row), and those roles lose their grants. A plain
// Postgres (local dev) has no such roles: the revokes are skipped.
await sql`
  do $$
  declare t record;
  begin
    for t in select tablename from pg_tables where schemaname = 'public' loop
      execute format('alter table public.%I enable row level security', t.tablename);
    end loop;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      revoke all on all tables in schema public from anon, authenticated;
      revoke all on all sequences in schema public from anon, authenticated;
      revoke all on all functions in schema public from anon, authenticated;
      alter default privileges in schema public revoke all on tables from anon, authenticated;
      alter default privileges in schema public revoke all on sequences from anon, authenticated;
      alter default privileges in schema public revoke all on functions from anon, authenticated;
    end if;
  end $$`;
await sql.end();
console.log(`Migrations applied (tables locked down) to ${url.replace(/:[^:@/]+@/, ":****@")}`);
