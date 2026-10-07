import type { EventType, Flavour, Lang, Me, Region } from "@wow-locker/shared";
import { NOTIFIABLE_EVENTS } from "@wow-locker/shared";
import { and, arrayOverlaps, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, characters, characterEvents, companionLinks, pushSubscription, sessions, type AccountRow } from "@/db/schema";
import { log } from "@/lib/log";

/**
 * WoWLocker accounts: a Battle.net login creates (or finds) the account and
 * opens a session. The session is a cookie holding a random token; only its
 * SHA-256 is stored, like companion tokens. Logging in also proves which
 * characters are the account's: they get it as their owner (private details,
 * sharing), and companions paired from the same Battle.net account join it.
 */

export const SESSION_COOKIE = "wl_session";
export const SESSION_TTL_MS = 180 * 86400_000;
/** A session used after this much of its life gets a fresh expiry. */
const RENEW_AFTER_MS = 86400_000;
export const MAX_ROSTER = 50; // the most ids /api/characters takes

const random = (bytes: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(h).toString("hex");
}

/** After a Battle.net login: the account (created on first login), owning `owned` in `region`. */
export async function loginAccount(login: {
  bnetId: number;
  battletag: string | null;
  region: Region;
  owned: number[];
  unavailable?: Flavour[];
}): Promise<AccountRow> {
  const [found] = await db.select().from(accounts).where(eq(accounts.bnetId, login.bnetId));
  const fresh = { region: login.region, ids: login.owned, at: new Date().toISOString(), unavailable: login.unavailable ?? [] };
  const owned = [...(found?.owned ?? []).filter((o) => o.region !== login.region), fresh];
  const [acc] = found
    ? await db.update(accounts).set({ battletag: login.battletag, owned, lastSeenAt: new Date() }).where(eq(accounts.id, found.id)).returning()
    : await db.insert(accounts).values({ bnetId: login.bnetId, battletag: login.battletag, owned }).returning();
  if (login.owned.length) {
    // Its characters already tracked here are now known to be its own…
    await db
      .update(characters)
      .set({ ownerId: acc.id })
      .where(and(eq(characters.region, login.region), inArray(characters.blizzardId, login.owned)));
    // …and companions paired from this Battle.net account (before accounts existed) join it.
    await db
      .update(companionLinks)
      .set({ accountId: acc.id })
      .where(and(isNull(companionLinks.accountId), eq(companionLinks.region, login.region), arrayOverlaps(companionLinks.ownedIds, login.owned)));
  }
  log.info("account.login", { account: acc.id, region: login.region, owned: login.owned.length, created: !found });
  return acc;
}

export async function createSession(accountId: number): Promise<string> {
  const token = random(32);
  await db.insert(sessions).values({ tokenHash: await sha256(token), accountId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

/** The account behind a session cookie (null: none, expired or revoked). */
export async function sessionAccount(token: string | undefined): Promise<AccountRow | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const [row] = await db
    .select({ a: accounts, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  // Sliding expiry, written at most once a day.
  if (row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - RENEW_AFTER_MS) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).where(eq(sessions.tokenHash, hash));
    await db.update(accounts).set({ lastSeenAt: new Date() }).where(eq(accounts.id, row.a.id));
  }
  return row.a;
}

export async function endSession(token: string | undefined): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
}

/** Scheduler: drop expired sessions. */
export async function sweepSessions(): Promise<number> {
  const gone = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ h: sessions.tokenHash });
  return gone.length;
}

export function meOf(a: AccountRow): Me {
  return {
    id: a.id,
    battletag: a.battletag,
    regions: a.owned.map((o) => o.region),
    roster: a.roster,
    lang: a.lang,
    events: a.events,
  };
}

/** Valid character ids, deduplicated, in order (unknown ids are dropped). */
export async function cleanRoster(ids: unknown): Promise<number[] | null> {
  if (!Array.isArray(ids)) return null;
  const wanted = [...new Set(ids.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, MAX_ROSTER);
  if (!wanted.length) return [];
  const known = new Set((await db.select({ id: characters.id }).from(characters).where(inArray(characters.id, wanted))).map((r) => r.id));
  return wanted.filter((id) => known.has(id));
}

export async function saveRoster(a: AccountRow, ids: number[]): Promise<AccountRow> {
  const [row] = await db.update(accounts).set({ roster: ids }).where(eq(accounts.id, a.id)).returning();
  return row;
}

export async function saveSettings(a: AccountRow, patch: { lang?: unknown; events?: unknown }): Promise<AccountRow> {
  const set: { lang?: Lang; events?: EventType[] } = {};
  if (patch.lang === "en" || patch.lang === "fr") set.lang = patch.lang;
  if (Array.isArray(patch.events)) set.events = NOTIFIABLE_EVENTS.filter((e) => (patch.events as unknown[]).includes(e));
  if (!Object.keys(set).length) return a;
  const [row] = await db.update(accounts).set(set).where(eq(accounts.id, a.id)).returning();
  return row;
}

/** Characters added by a companion upload join the account's locker (at the end). */
export async function addToAccountRoster(accountId: number, characterId: number): Promise<void> {
  await db
    .update(accounts)
    .set({ roster: sql`array_append(${accounts.roster}, ${characterId})` })
    .where(and(eq(accounts.id, accountId), sql`not (${characterId} = any(${accounts.roster}))`, sql`cardinality(${accounts.roster}) < ${MAX_ROSTER}`));
}

/** Owner only: open (or close) a character's private details to anyone. */
export async function setShared(a: AccountRow, characterId: number, shared: boolean): Promise<boolean> {
  const rows = await db
    .update(characters)
    .set({ shared })
    .where(and(eq(characters.id, characterId), eq(characters.ownerId, a.id)))
    .returning({ id: characters.id });
  return rows.length > 0;
}

/**
 * Delete the account: its sessions, its companions (no more uploads), and the
 * private addon data of its characters — once unowned they'd be public, so
 * what only the owner could see goes with the account. Their public profile
 * (level, gear, timeline) stays, like any character tracked by name.
 */
export async function deleteAccount(a: AccountRow): Promise<void> {
  await db.transaction(async (tx) => {
    const owned = await tx.update(characters).set({ addon: null, shared: false }).where(eq(characters.ownerId, a.id)).returning({ id: characters.id });
    if (owned.length) {
      // Reminders carry mail subjects: personal.
      await tx.delete(characterEvents).where(and(inArray(characterEvents.characterId, owned.map((o) => o.id)), eq(characterEvents.type, "reminder")));
    }
    await tx.delete(companionLinks).where(eq(companionLinks.accountId, a.id));
    await tx.update(pushSubscription).set({ accountId: null }).where(eq(pushSubscription.accountId, a.id));
    await tx.delete(accounts).where(eq(accounts.id, a.id)); // sessions cascade, owners set null
  });
  log.info("account.deleted", { account: a.id });
}
