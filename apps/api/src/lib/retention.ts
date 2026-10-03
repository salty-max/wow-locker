import type { EventData } from "@wow-locker/shared";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { characterEvents, characters } from "@/db/schema";
import { log } from "@/lib/log";
import { sessionRecaps } from "@/lib/sessions";
import { getState, setState } from "@/lib/state";

/**
 * How long the timeline keeps what. Milestones stay for good: levels, deaths,
 * close calls, gear, talents, dungeons, loot, reputation, pets, guilds, and
 * session summaries. Noise goes after 90 days: logins, /reload logouts,
 * accepted quests, skill-ups, reminders. A character never keeps more than
 * MAX_EVENTS (the oldest go first, deaths and levels last).
 *
 * The addon's file keeps its last 5000 events and the dedupe works on stored
 * rows: an upload skips noise older than the cutoff, or pruned rows would
 * come back with every upload.
 */
export const NOISE_AFTER_MS = 90 * 86400_000;
export const MAX_EVENTS = 20_000;
const PRUNE_EVERY_MS = 3600_000;
/** Above this, the database is getting near the Supabase free plan's 500 MB. */
const DB_WARN_BYTES = 400 * 1024 * 1024;

export function isNoise(d: EventData): boolean {
  switch (d.type) {
    case "session":
      return d.action === "login" || !d.recap; // logins and /reload logouts
    case "quest":
      return d.action === "accept";
    case "skill":
      return !d.learned;
    case "reminder":
      return true;
    default:
      return false;
  }
}

/** isNoise, in SQL. */
const NOISE = sql`(
  ${characterEvents.type} = 'reminder'
  or (${characterEvents.type} = 'session' and (${characterEvents.data}->>'action' = 'login' or not (${characterEvents.data} ? 'recap')))
  or (${characterEvents.type} = 'quest' and ${characterEvents.data}->>'action' = 'accept')
  or (${characterEvents.type} = 'skill' and coalesce((${characterEvents.data}->>'learned')::boolean, false) = false)
)`;

/** An upload's events, without the noise the timeline would have pruned already. */
export function withinRetention<T extends { at: Date; data: EventData }>(events: T[], now = Date.now()): T[] {
  return events.filter((e) => !(isNoise(e.data) && now - e.at.getTime() > NOISE_AFTER_MS));
}

/** Scheduler (hourly): prune old noise, a few characters at a time; watch the database size. */
export async function pruneTimeline(now = Date.now(), batch = 5): Promise<{ pruned: number }> {
  const last = await getState("pruneAt");
  if (last && now - Date.parse(last) < PRUNE_EVERY_MS) return { pruned: 0 };
  const cutoff = new Date(now - NOISE_AFTER_MS);
  const due = await db
    .selectDistinct({ id: characterEvents.characterId })
    .from(characterEvents)
    .where(and(lt(characterEvents.at, cutoff), NOISE))
    .limit(batch);
  let pruned = 0;
  for (const { id } of due) pruned += await pruneCharacter(id, cutoff);
  // More to do: come back at the next tick instead of in an hour.
  if (due.length < batch) await setState("pruneAt", new Date(now).toISOString());

  const [{ bytes }] = await db.execute<{ bytes: string }>(sql`select pg_database_size(current_database())::text as bytes`) as unknown as { bytes: string }[];
  if (Number(bytes) > DB_WARN_BYTES) log.warn("db.size", { mb: Math.round(Number(bytes) / 1048576) });
  if (pruned) log.info("timeline.pruned", { characters: due.length, events: pruned });
  return { pruned };
}

async function pruneCharacter(characterId: number, cutoff: Date): Promise<number> {
  const [c] = await db.select({ flavour: characters.flavour }).from(characters).where(eq(characters.id, characterId));
  if (!c) return 0;
  // Sessions about to lose their login: keep what they brought on the logout first.
  const old = await db
    .select()
    .from(characterEvents)
    .where(and(eq(characterEvents.characterId, characterId), lt(characterEvents.at, new Date(cutoff.getTime() + 86400_000))))
    .orderBy(asc(characterEvents.at), asc(characterEvents.id));
  const recaps = sessionRecaps(old, c.flavour, Infinity);
  for (const e of old) {
    const r = recaps.get(e.id);
    if (r && e.data.type === "session" && !e.data.recap) {
      await db.update(characterEvents).set({ data: { ...e.data, recap: r } }).where(eq(characterEvents.id, e.id));
    }
  }
  const gone = await db
    .delete(characterEvents)
    .where(and(eq(characterEvents.characterId, characterId), lt(characterEvents.at, cutoff), NOISE))
    .returning({ id: characterEvents.id });
  return gone.length;
}

/** After an upload: past MAX_EVENTS, drop the oldest (deaths and levels only if nothing else is left). */
export async function capCharacter(characterId: number, max = MAX_EVENTS): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(characterEvents)
    .where(eq(characterEvents.characterId, characterId));
  const excess = n - max;
  if (excess <= 0) return 0;
  const victims = await db
    .select({ id: characterEvents.id })
    .from(characterEvents)
    .where(eq(characterEvents.characterId, characterId))
    .orderBy(sql`(${characterEvents.type} in ('death', 'level'))`, asc(characterEvents.at), desc(characterEvents.id))
    .limit(excess);
  await db.delete(characterEvents).where(inArray(characterEvents.id, victims.map((v) => v.id)));
  log.info("timeline.capped", { character: characterId, dropped: victims.length });
  return victims.length;
}
