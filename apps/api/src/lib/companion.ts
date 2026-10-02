import type { Flavour, PairPoll, PairStart, Region, UploadResult } from "@wow-locker/shared";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { characterEvents, characters, companionLinks, reminders, type CharacterRow } from "@/db/schema";
import { computeReminders, parseAddonCharacter, type AddonCharacter } from "@/lib/addon";
import { log } from "@/lib/log";
import { deliverEvent } from "@/lib/push";
import { addCharacter } from "@/lib/tracker";

/**
 * The companion app: pairing (device-code style, ownership proven by a
 * Battle.net login) and uploads of the in-game addon's data.
 *
 *   1. companion → POST /pair/start  → { code, pollToken, url }; it opens `url`
 *   2. the user logs in with Battle.net on that page (state carries the code)
 *   3. the OAuth callback calls completePairing(): a link is created with the
 *      account's character ids, and a token is minted (only its hash is kept)
 *   4. companion → POST /pair/poll   → { token } once
 *   5. companion → POST /upload (Bearer token) after each logout / reload
 */

const PAIR_TTL_MS = 10 * 60_000;
// No 0/O or 1/I: the code may be read off one screen and typed on another.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Pending = {
  pollToken: string;
  at: number;
  result?: { token: string; battletag: string | null; characters: number };
};
const pairings = new Map<string, Pending>();

const random = (bytes: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(h).toString("hex");
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of pairings) if (now - v.at > PAIR_TTL_MS) pairings.delete(k);
}

export function startPairing(origin: string): PairStart {
  sweep();
  const pick = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(pick, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const pollToken = random(24);
  pairings.set(code, { pollToken, at: Date.now() });
  return { code, pollToken, url: `${origin}/pair?code=${code}`, expiresIn: PAIR_TTL_MS / 1000 };
}

export function pairingExists(code: string): boolean {
  sweep();
  return pairings.has(code);
}

/** Called from the Battle.net callback: the login proved which characters are the user's. */
export async function completePairing(
  code: string,
  account: { region: Region; battletag: string | null; owned: { id: number; flavour: Flavour; realmSlug: string; name: string }[] },
): Promise<boolean> {
  const p = pairings.get(code);
  if (!p) return false;
  const token = random(32);
  await db.insert(companionLinks).values({
    tokenHash: await sha256(token),
    region: account.region,
    battletag: account.battletag,
    ownedIds: account.owned.map((c) => c.id),
    owned: account.owned,
  });
  // Exposed to the poll only once the link exists.
  p.result = { token, battletag: account.battletag, characters: account.owned.length };
  log.info("companion.paired", { battletag: account.battletag, characters: account.owned.length });
  return true;
}

export function pollPairing(code: string, pollToken: string): PairPoll {
  sweep();
  const p = pairings.get(code);
  if (!p || p.pollToken !== pollToken) return { status: "expired" };
  if (!p.result) return { status: "pending" };
  pairings.delete(code); // the token is handed over exactly once
  return { status: "paired", ...p.result };
}

export async function linkFor(token: string) {
  const [link] = await db.select().from(companionLinks).where(eq(companionLinks.tokenHash, await sha256(token)));
  return link ?? null;
}

// ── uploads ──────────────────────────────────────────────────────────────────

/** Events older than this at upload time are history: stored, not pushed. */
const PUSH_WINDOW_MS = 24 * 3600_000;

export async function handleUpload(token: string, body: unknown): Promise<UploadResult | null> {
  const link = await linkFor(token);
  if (!link) return null;
  const chars = (body && typeof body === "object" ? (body as { characters?: unknown }).characters : null) ?? {};
  const result: UploadResult = { characters: [] };

  for (const [guid, raw] of Object.entries(chars as Record<string, unknown>).slice(0, 60)) {
    const parsed = parseAddonCharacter(guid, raw);
    if (!parsed) {
      result.characters.push({ guid, name: "?", status: "invalid", events: 0 });
      continue;
    }
    // Only characters the Battle.net login proved to be this account's.
    const owned = link.owned.find((c) => c.id === parsed.characterId);
    if (!owned) {
      result.characters.push({ guid, name: parsed.name, status: "unknown", events: 0 });
      continue;
    }
    const row = await characterFor(link.region, owned);
    if (!row) {
      result.characters.push({ guid, name: parsed.name, status: "unknown", events: 0 });
      continue;
    }
    const added = await applyAddon(row, parsed);
    result.characters.push({ guid, name: parsed.name, status: "synced", events: added, characterId: row.id });
  }
  await db.update(companionLinks).set({ lastUploadAt: new Date() }).where(eq(companionLinks.id, link.id));
  return result;
}

/** The tracked row for an owned character, tracking it on its first upload. */
async function characterFor(
  region: Region,
  owned: { id: number; flavour: Flavour; realmSlug: string; name: string },
): Promise<CharacterRow | null> {
  const [byId] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.region, region), eq(characters.blizzardId, owned.id)));
  if (byId) return byId;
  try {
    const summary = await addCharacter({ region, flavour: owned.flavour, realm: owned.realmSlug, name: owned.name });
    const [row] = await db.select().from(characters).where(eq(characters.id, summary.id));
    return row ?? null;
  } catch (err) {
    log.warn("companion.track.failed", { name: owned.name, err: String(err) });
    return null;
  }
}

async function applyAddon(c: CharacterRow, parsed: AddonCharacter): Promise<number> {
  const now = new Date();
  // Insert new events only (re-uploading the same file adds nothing).
  let added = 0;
  const fresh: { id: number; at: Date }[] = [];
  const stale: number[] = [];
  for (let i = 0; i < parsed.events.length; i += 500) {
    const rows = await db
      .insert(characterEvents)
      .values(
        parsed.events
          .slice(i, i + 500)
          .map((e) => ({ characterId: c.id, type: e.data.type, data: e.data, source: "addon" as const, dedupeKey: e.key, at: e.at })),
      )
      .onConflictDoNothing()
      .returning({ id: characterEvents.id, at: characterEvents.at, type: characterEvents.type });
    for (const row of rows) {
      added++;
      if (now.getTime() - row.at.getTime() < PUSH_WINDOW_MS && row.type !== "session") fresh.push(row);
      else stale.push(row.id);
    }
  }
  // History and sessions are never pushed.
  if (stale.length) await db.update(characterEvents).set({ notifiedAt: now }).where(inArray(characterEvents.id, stale));
  fresh.sort((a, b) => a.at.getTime() - b.at.getTime());

  const state = { ...parsed.state, syncedAt: now.toISOString() };
  const [updated] = await db.update(characters).set({ addon: state }).where(eq(characters.id, c.id)).returning();

  // Reminders: recomputed from scratch on every upload (stale ones disappear).
  const lastSession = [...parsed.events].reverse().find((e) => e.data.type === "session");
  const loggedOut = lastSession?.data.type === "session" && lastSession.data.action === "logout";
  await db.delete(reminders).where(and(eq(reminders.characterId, c.id), isNull(reminders.sentAt)));
  const planned = computeReminders({
    state: parsed.state,
    level: updated.level,
    xpMax: parsed.state.xpMax,
    flavour: updated.flavour,
    loggedOut,
    now,
  });
  if (planned.length) {
    await db
      .insert(reminders)
      .values(planned.map((r) => ({ characterId: c.id, kind: r.kind, key: r.key, fireAt: r.fireAt, data: r.data })))
      .onConflictDoNothing();
  }

  // Push what just happened (the event rows carry the dedupe; notifiedAt the retry).
  for (const e of fresh) {
    const [ev] = await db.select().from(characterEvents).where(eq(characterEvents.id, e.id));
    const r = await deliverEvent(updated, ev);
    if (r.sent > 0 || r.targets === 0) await db.update(characterEvents).set({ notifiedAt: new Date() }).where(eq(characterEvents.id, ev.id));
  }
  log.info("companion.upload", { character: updated.name, events: added, reminders: planned.length });
  return added;
}

/** Scheduler tick: turn due reminders into timeline events and pushes. */
export async function fireReminders(): Promise<{ fired: number }> {
  const due = await db
    .select({ r: reminders, c: characters })
    .from(reminders)
    .innerJoin(characters, eq(characters.id, reminders.characterId))
    .where(and(isNull(reminders.sentAt), lte(reminders.fireAt, new Date())))
    .limit(50);
  let fired = 0;
  for (const { r, c } of due) {
    const [ev] = await db
      .insert(characterEvents)
      .values({
        characterId: c.id,
        type: "reminder",
        data: r.data,
        source: "scheduled",
        dedupeKey: `r:${r.kind}:${r.key}:${r.fireAt.toISOString()}`,
        at: r.fireAt,
      })
      .onConflictDoNothing()
      .returning();
    await db.update(reminders).set({ sentAt: new Date() }).where(eq(reminders.id, r.id));
    if (!ev) continue;
    const res = await deliverEvent(c, ev);
    if (res.sent > 0 || res.targets === 0) await db.update(characterEvents).set({ notifiedAt: new Date() }).where(eq(characterEvents.id, ev.id));
    fired++;
  }
  return { fired };
}

