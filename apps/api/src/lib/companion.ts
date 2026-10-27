import { REGIONS, type EventData, type Flavour, type PairPoll, type PairStart, type Region, type UploadResult } from "@wow-locker/shared";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { accounts, characterEvents, characters, companionLinks, reminders, type CharacterRow } from "@/db/schema";
import { addToAccountRoster } from "@/lib/accounts";
import { computeReminders, parseAddonCharacter, type AddonCharacter } from "@/lib/addon";
import { isGone, superseded, type OwnedList } from "@/lib/diff";
import { claimTemp, getTemp, putTemp, setTemp, takeTemp } from "@/lib/ephemeral";
import { log } from "@/lib/log";
import { deliverEvent } from "@/lib/push";
import { capCharacter, withinRetention } from "@/lib/retention";
import { addCharacter, addonItemIds, fillIcons, NotFoundError } from "@/lib/tracker";
import { waitUntil } from "@vercel/functions";
import { ownedCharacter, refreshedOwned } from "@/lib/ownership";
import { readPassport, type Passport } from "@/lib/passport";

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

// In the ephemeral table (any server instance can answer the poll). The raw
// upload token sits there only between the login and the companion's next
// poll (seconds; 10 min at most), then the row is deleted.
type Pending = {
  pollTokenHash: string;
  result: { token: string; battletag: string | null; characters: number } | null;
};

const random = (bytes: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(h).toString("hex");
}

export async function startPairing(origin: string): Promise<PairStart> {
  const pick = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(pick, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const pollToken = random(24);
  await putTemp("pair", code, { pollTokenHash: await sha256(pollToken), result: null } satisfies Pending, PAIR_TTL_MS);
  return { code, pollToken, url: `${origin}/pair?code=${code}`, expiresIn: PAIR_TTL_MS / 1000 };
}

export async function pairingExists(code: string): Promise<boolean> {
  return (await getTemp<Pending>("pair", code)) != null;
}

/** Called from the Battle.net callback: the login proved which characters are the user's. */
export async function completePairing(
  code: string,
  account: {
    region: Region;
    battletag: string | null;
    owned: { id: number; flavour: Flavour; realmSlug: string; name: string }[];
    unavailable: Flavour[];
    accountId: number | null;
  },
): Promise<boolean> {
  const p = await getTemp<Pending>("pair", code);
  if (!p || p.result) return false;
  const token = random(32);
  await db.insert(companionLinks).values({
    tokenHash: await sha256(token),
    region: account.region,
    battletag: account.battletag,
    ownedIds: account.owned.map((c) => c.id),
    owned: account.owned,
    unavailable: account.unavailable,
    accountId: account.accountId,
  });
  // Exposed to the poll only once the link exists.
  if (!(await setTemp("pair", code, { ...p, result: { token, battletag: account.battletag, characters: account.owned.length } }))) return false;
  log.info("companion.paired", { account: account.accountId, characters: account.owned.length });
  return true;
}

export async function pollPairing(code: string, pollToken: string): Promise<PairPoll> {
  const p = await getTemp<Pending>("pair", code);
  if (!p || p.pollTokenHash !== (await sha256(pollToken))) return { status: "expired" };
  if (!p.result) return { status: "pending" };
  // The token is handed over exactly once: whoever deletes the row gets it.
  const taken = await takeTemp<Pending>("pair", code);
  return taken?.result ? { status: "paired", ...taken.result } : { status: "expired" };
}

export async function linkFor(token: string) {
  const [link] = await db.select().from(companionLinks).where(eq(companionLinks.tokenHash, await sha256(token)));
  return link ?? null;
}

// ── uploads ──────────────────────────────────────────────────────────────────

/** Timeline only, never pushed: logins, quests being accepted, pet levels. */
const quiet = (d: EventData) =>
  (d.type === "session" && d.action === "login") || (d.type === "quest" && d.action === "accept") || (d.type === "pet" && d.action === "level");
/** Logouts: pushed as a session recap by the scheduler, once it's not a /reload. */
const deferred = (d: EventData) => d.type === "session" && d.action === "logout";

/** Events older than this at upload time are history: stored, not pushed. */
const PUSH_WINDOW_MS = 24 * 3600_000;

export async function handleUpload(token: string, body: unknown): Promise<UploadResult | null> {
  const link = await linkFor(token);
  if (!link) return null;
  const chars = (body && typeof body === "object" ? (body as { characters?: unknown }).characters : null) ?? {};
  const result: UploadResult = { characters: [] };

  // What Battle.net said the account had: at pairing, and at its last login on the site.
  const lists: OwnedList[] = [{ at: link.createdAt, ids: link.ownedIds, unavailable: link.unavailable }];
  let fresh: (typeof accounts.$inferSelect)["owned"][number] | undefined;
  if (link.accountId != null) {
    const [acc] = await db.select({ owned: accounts.owned }).from(accounts).where(eq(accounts.id, link.accountId));
    fresh = acc?.owned.find((o) => o.region === link.region);
    if (fresh?.at) lists.push({ at: new Date(fresh.at), ids: fresh.ids, unavailable: fresh.unavailable ?? null });
  }
  const entries = Object.entries(chars as Record<string, unknown>)
    .slice(0, 60)
    .map(([guid, raw]) => ({ guid, parsed: parseAddonCharacter(guid, raw) }));
  const replaced = superseded(
    entries.flatMap(({ guid, parsed }) => (parsed ? [{ guid, realmId: parsed.realmId, name: parsed.name, lastSeen: parsed.state.updatedAt }] : [])),
  );

  for (const { guid, parsed } of entries) {
    if (!parsed) {
      result.characters.push({ guid, name: "?", status: "invalid", events: 0 });
      continue;
    }
    if (replaced.has(guid)) {
      result.characters.push({ guid, name: parsed.name, status: "gone", events: 0 });
      continue;
    }
    // Only characters the Battle.net login proved to be this account's.
    const owned = ownedCharacter(link.region, parsed.characterId, link.owned, fresh);
    if (!owned) {
      const gone = isGone(lists, parsed.characterId, false, parsed.state.updatedAt, false);
      result.characters.push({ guid, name: parsed.name, status: gone ? "gone" : "unknown", events: 0 });
      continue;
    }
    const row = await characterFor(link.region, owned, parsed, link.accountId);
    if (isGone(lists, parsed.characterId, true, parsed.state.updatedAt, row.missingReportedAt != null)) {
      result.characters.push({ guid, name: parsed.name, status: "gone", events: 0, characterId: row.id });
      continue;
    }
    // The companion's account owns what it uploads, and has it in its locker.
    if (link.accountId != null) {
      if (row.ownerId !== link.accountId) await db.update(characters).set({ ownerId: link.accountId }).where(eq(characters.id, row.id));
      row.ownerId = link.accountId;
      await addToAccountRoster(link.accountId, row.id);
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
  parsed: AddonCharacter,
  accountId: number | null,
): Promise<CharacterRow> {
  const [byId] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.region, region), eq(characters.flavour, owned.flavour), eq(characters.blizzardId, owned.id)));
  if (byId) return byId;
  try {
    const summary = await addCharacter({ region, flavour: owned.flavour, realm: owned.realmSlug, name: owned.name });
    const [row] = await db.select().from(characters).where(eq(characters.id, summary.id));
    if (!row) throw new Error("tracked character disappeared during upload");
    if (row.blizzardId !== owned.id) throw new Error("tracked character does not match the verified Battle.net id");
    return row;
  } catch (err) {
    if (!(err instanceof NotFoundError) || accountId == null) {
      log.warn("companion.track.failed", { name: owned.name, err: String(err) });
      throw err;
    }
    log.info("companion.profile.pending", { name: owned.name });
    // The account list proves ownership even before Blizzard publishes an
    // Armory profile. Create a private row and keep the addon data now.
    const [created] = await db
      .insert(characters)
      .values({
        region,
        flavour: owned.flavour,
        realmSlug: owned.realmSlug,
        realmName: parsed.realm || owned.realmSlug,
        name: owned.name,
        nameKey: owned.name.toLowerCase(),
        blizzardId: owned.id,
        ownerId: accountId,
        ...parsed.profile,
        level: parsed.profile.level ?? 1,
        fetchedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [concurrent] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.region, region), eq(characters.flavour, owned.flavour), eq(characters.blizzardId, owned.id)));
    if (!concurrent) throw new Error("character identity conflicts with another recorded life", { cause: err });
    return concurrent;
  }
}

async function applyAddon(c: CharacterRow, parsed: AddonCharacter): Promise<number> {
  const now = new Date();
  // Insert new events only (re-uploading the same file adds nothing).
  let added = 0;
  const fresh: { id: number; at: Date }[] = [];
  const stale: number[] = [];
  // Noise older than the timeline keeps it (see retention.ts) isn't stored again.
  const incoming = withinRetention(parsed.events, now.getTime());
  for (let i = 0; i < incoming.length; i += 500) {
    const chunk = incoming.slice(i, i + 500);
    const rows = await db
      .insert(characterEvents)
      .values(
        chunk.map((e) => ({ characterId: c.id, type: e.data.type, data: e.data, source: "addon" as const, dedupeKey: e.key, at: e.at })),
      )
      .onConflictDoNothing()
      .returning({ id: characterEvents.id, at: characterEvents.at, type: characterEvents.type, data: characterEvents.data });
    for (const row of rows) {
      added++;
      const recent = now.getTime() - row.at.getTime() < PUSH_WINDOW_MS;
      if (recent && deferred(row.data)) continue; // left un-notified for pushSessionRecaps
      if (recent && !quiet(row.data)) fresh.push(row);
      else stale.push(row.id);
    }
  }
  // History, logins and accepted quests are never pushed.
  if (stale.length) await db.update(characterEvents).set({ notifiedAt: now }).where(inArray(characterEvents.id, stale));
  fresh.sort((a, b) => a.at.getTime() - b.at.getTime());

  if (added) await capCharacter(c.id);

  const state = { ...parsed.state, syncedAt: now.toISOString() };
  const profile = c.snapshotVersion === 0 ? { ...parsed.profile, level: parsed.profile.level ?? c.level } : {};
  const [updated] = await db.update(characters).set({ ...profile, addon: state }).where(eq(characters.id, c.id)).returning();

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
  // Icons for what's in the bags, bank and mail: fetched once per item, in the background.
  waitUntil(fillIcons(updated, addonItemIds(updated.addon)).catch((err) => log.warn("icons.failed", { err: String(err) })));
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


/**
 * Ravenpost signed in with Battle.net (its passport): the account's proof of
 * its Classic Era characters is renewed, so a character made since the last
 * login on the site syncs without one. Only for a link that belongs to the
 * same Battle.net account the passport names.
 */
export async function refreshWithPassport(token: string, passport: unknown): Promise<{ characters: number } | null> {
  const link = await linkFor(token);
  if (!link || link.accountId == null) return null;
  const p = readPassport(passport);
  return p ? renewOwned(link.accountId, p) : null;
}

/** The account's proof renewed from a passport that was checked: only if it names this account, and once. */
export async function renewOwned(accountId: number, p: Passport): Promise<{ characters: number } | null> {
  const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!acc || acc.bnetId !== p.bnetId) return null;
  // (once: a passport seen before is refused)
  if (!(await claimTemp("passport", p.jti, 15 * 60_000))) return null;
  let owned = acc.owned;
  let count = 0;
  const now = new Date();
  for (const o of p.owned) {
    if (!REGIONS.includes(o.region as Region) || !Array.isArray(o.ids)) continue;
    const ids = o.ids.filter((id) => Number.isSafeInteger(id));
    const chars = (Array.isArray(o.characters) ? o.characters : []).filter(
      (c): c is [number, string, string] => Array.isArray(c) && Number.isSafeInteger(c[0]) && typeof c[1] === "string" && typeof c[2] === "string" && ids.includes(c[0]),
    );
    const entry = refreshedOwned(owned.find((e) => e.region === o.region), o.region as Region, ids, chars, now);
    owned = [...owned.filter((e) => e.region !== o.region), entry];
    count += chars.length;
  }
  await db.update(accounts).set({ owned, lastSeenAt: now }).where(eq(accounts.id, acc.id));
  log.info("companion.refreshed", { account: acc.id, characters: count });
  return { characters: count };
}
