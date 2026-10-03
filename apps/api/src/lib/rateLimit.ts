import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Per-client limits on what costs us something: a Battle.net call, a stored
 * row, a pairing. Fixed windows counted in the ephemeral table (any server
 * instance sees the same count; the tick sweeps old windows).
 */
export type Limit = { name: string; max: number; windowMs: number };

export const LIMITS = {
  /** Item tooltips: a cache miss is a Battle.net call. A full bank is ~150 items. */
  tooltip: { name: "tooltip", max: 400, windowMs: 10 * 60_000 },
  /** Tracking a character by name (Battle.net calls, then polled for 30 days). */
  addCharacter: { name: "add", max: 30, windowMs: 3600_000 },
  /** Battle.net logins and companion pairings started. */
  login: { name: "login", max: 30, windowMs: 3600_000 },
  pair: { name: "pair", max: 15, windowMs: 3600_000 },
  /** Push subscriptions saved (each device resyncs on roster or settings changes). */
  push: { name: "push", max: 120, windowMs: 3600_000 },
  /** Item search across a roster. */
  items: { name: "items", max: 300, windowMs: 10 * 60_000 },
  /** Companion uploads (normally one per logout or /reload). */
  upload: { name: "upload", max: 120, windowMs: 3600_000 },
} satisfies Record<string, Limit>;

/** The client's address. On Vercel, x-real-ip / x-forwarded-for are set by the platform. */
export function clientIp(headers: { get(name: string): string | null | undefined }): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Count one hit. Returns the seconds to wait when over the limit, else 0. */
export async function hit(limit: Limit, client: string): Promise<number> {
  const key = `${limit.name}:${client}`.slice(0, 200);
  const windowSql = sql.raw(`interval '${Math.round(limit.windowMs / 1000)} seconds'`);
  const rows = await db.execute<{ n: number; expires_at: string }>(sql`
    insert into ephemeral (kind, key, data, expires_at)
    values ('rate', ${key}, '{"n":1}'::jsonb, now() + ${windowSql})
    on conflict (kind, key) do update set
      data = case when ephemeral.expires_at < now() then '{"n":1}'::jsonb
                  else jsonb_build_object('n', (ephemeral.data->>'n')::int + 1) end,
      expires_at = case when ephemeral.expires_at < now() then now() + ${windowSql} else ephemeral.expires_at end
    returning (data->>'n')::int as n, expires_at`);
  const row = (rows as unknown as { n: number; expires_at: string | Date }[])[0];
  if (!row || row.n <= limit.max) return 0;
  return Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 1000));
}
