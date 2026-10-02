import type { AddCharacterRequest, CharacterDetail, CharacterEvent, CharacterSummary, EventData } from "@wow-locker/shared";
import { FLAVOURS, REGIONS } from "@wow-locker/shared";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { characterEvents, characters, itemIcons, type CharacterRow, type EventRow } from "@/db/schema";
import { api, BnetError } from "@/lib/bnet";
import { xpToNext } from "@/lib/classic";
import { availabilityStep, diffSnapshots } from "@/lib/diff";
import { log } from "@/lib/log";
import { fromEquipment, fromSpecializations, fromStatistics, fromSummary } from "@/lib/normalize";
import { deliverEvent } from "@/lib/push";
import { realmCategory } from "@/lib/realms";

/** How often a tracked character is re-checked. Profiles only change on logout,
 *  and a check costs 1 request when nothing changed (summary only). */
const REFRESH_EVERY_MS = 10 * 60_000;
/** Fallen Hardcore characters and missing ones don't change: check daily. */
const SLOW_REFRESH_MS = 24 * 3600_000;
/**
 * Bump whenever the stored snapshot gains data (2 = learned talents per
 * tree, 3 = item tooltips). The cheap "nothing changed since last login" path is skipped for
 * older snapshots, so every character gets the new data on its next tick
 * instead of waiting for its next login.
 */
export const SNAPSHOT_VERSION = 3;

/** Event types the addon records itself (exactly): not diffed for addon users. */
const ADDON_COVERS = new Set<EventData["type"]>(["level", "gear", "respec", "guild", "death"]);

/** Addon data older than this: assume the addon is gone and diff everything again. */
const ADDON_STALE_MS = 14 * 86400_000;

/** How long after a login we keep looking for a missing full-body render. */
const RENDER_WAIT_MS = 3 * 86400_000;

/** Characters nobody has opened for this long stop being polled. */
const DORMANT_AFTER_MS = 30 * 86400_000;

export class InputError extends Error {}
export class NotFoundError extends Error {}

const nameKey = (n: string) => n.trim().toLowerCase();

export function toSummary(c: CharacterRow): CharacterSummary {
  return {
    id: c.id,
    region: c.region,
    flavour: c.flavour,
    realmSlug: c.realmSlug,
    realmName: c.realmName,
    realmCategory: c.realmCategory,
    name: c.name,
    level: c.level,
    experience: c.experience,
    xpToNext: xpToNext(c.flavour, c.level),
    race: c.race,
    className: c.className,
    classKey: c.classKey,
    gender: c.gender,
    faction: c.faction,
    guild: c.guild,
    isGhost: c.isGhost,
    isSelfFound: c.isSelfFound,
    itemLevel: c.itemLevel,
    avatarUrl: c.avatarUrl,
    renderUrl: c.renderUrl,
    lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
    deadAt: c.deadAt?.toISOString() ?? null,
    // A single "not found" may be a Blizzard blip: only a confirmed (reported)
    // disappearance shows as missing.
    status: c.status === "not_found" && !c.missingReportedAt ? "ok" : c.status,
    fetchedAt: c.fetchedAt?.toISOString() ?? null,
  };
}

const toEvent = (e: EventRow): CharacterEvent => ({
  id: e.id,
  characterId: e.characterId,
  at: e.at.toISOString(),
  source: e.source,
  data: e.data,
});

export async function getCharacters(ids: number[]): Promise<CharacterSummary[]> {
  if (!ids.length) return [];
  const rows = await db.select().from(characters).where(inArray(characters.id, ids));
  // Being looked at keeps a character "hot" for the poller.
  await db.update(characters).set({ requestedAt: new Date() }).where(inArray(characters.id, ids));
  return rows.map(toSummary);
}

export async function getCharacter(id: number): Promise<CharacterDetail | null> {
  const [c] = await db.select().from(characters).where(eq(characters.id, id));
  if (!c) return null;
  await db.update(characters).set({ requestedAt: new Date() }).where(eq(characters.id, id));
  const events = await db
    .select()
    .from(characterEvents)
    .where(eq(characterEvents.characterId, id))
    .orderBy(desc(characterEvents.at), desc(characterEvents.id))
    .limit(300);
  return {
    ...toSummary(c),
    equipment: c.equipment,
    talents: c.talents,
    stats: c.stats,
    events: events.map(toEvent),
    addon: c.addon ?? null,
  };
}

/** Start tracking a character (or return the existing row). */
export async function addCharacter(req: AddCharacterRequest): Promise<CharacterSummary> {
  if (!REGIONS.includes(req.region) || !FLAVOURS.includes(req.flavour)) throw new InputError("bad region or flavour");
  const realm = req.realm.trim().toLowerCase();
  const key = nameKey(req.name);
  if (!/^[a-z0-9-]{2,40}$/.test(realm) || !/^\p{L}{2,12}$/u.test(key)) throw new InputError("bad realm or name");

  const identity = and(
    eq(characters.region, req.region),
    eq(characters.flavour, req.flavour),
    eq(characters.realmSlug, realm),
    eq(characters.nameKey, key),
  );
  const [existing] = await db.select().from(characters).where(identity);
  if (existing) return (await getCharacters([existing.id]))[0];

  let summary;
  try {
    summary = await api.summary(req.flavour, req.region, realm, key);
  } catch (err) {
    if (err instanceof BnetError && err.status === 404) throw new NotFoundError("character not found");
    throw err;
  }
  const [row] = await db
    .insert(characters)
    .values({
      region: req.region,
      flavour: req.flavour,
      realmSlug: realm,
      realmName: summary.realm.name,
      realmCategory: await realmCategory(req.region, req.flavour, realm),
      nameKey: key,
      name: summary.name,
    })
    .onConflictDoNothing()
    .returning();
  const created = row ?? (await db.select().from(characters).where(identity))[0];
  const fresh = await refreshCharacter(created, { force: true });
  if (row) {
    await db
      .insert(characterEvents)
      .values({ characterId: created.id, type: "tracked", data: { type: "tracked", level: fresh.level }, notifiedAt: new Date() });
  }
  return toSummary(fresh);
}

async function iconsFor(c: CharacterRow, itemIds: number[]): Promise<Map<number, string | null>> {
  const known = itemIds.length
    ? await db
        .select()
        .from(itemIcons)
        .where(and(eq(itemIcons.region, c.region), eq(itemIcons.flavour, c.flavour), inArray(itemIcons.itemId, itemIds)))
    : [];
  const map = new Map(known.map((k) => [k.itemId, k.url]));
  for (const id of itemIds) {
    if (map.has(id)) continue;
    let url: string | null = null;
    try {
      const m = await api.itemMedia(c.flavour, c.region, id);
      url = m.assets?.find((a) => a.key === "icon")?.value ?? null;
    } catch {
      /* no icon: remembered as null so we don't ask again */
    }
    map.set(id, url);
    await db.insert(itemIcons).values({ region: c.region, flavour: c.flavour, itemId: id, url }).onConflictDoNothing();
  }
  return map;
}

/**
 * Re-read a character. Cheap path: the summary alone, when the last login
 * hasn't moved (nothing else can have changed). Otherwise everything, then the
 * differences become events (and pushes).
 */
/** Store events and push them; a push that reached nobody is retried later. */
async function recordEvents(row: CharacterRow, events: EventData[]): Promise<void> {
  for (const data of events) {
    const [ev] = await db.insert(characterEvents).values({ characterId: row.id, type: data.type, data }).returning();
    log.info("character.event", { id: row.id, name: row.name, type: data.type });
    const r = await deliverEvent(row, ev);
    if (r.sent > 0 || r.targets === 0) {
      await db.update(characterEvents).set({ notifiedAt: new Date() }).where(eq(characterEvents.id, ev.id));
    }
  }
}

export async function refreshCharacter(c: CharacterRow, { force = false } = {}): Promise<CharacterRow> {
  const prevAvail = { status: c.status, missingReported: c.missingReportedAt != null };
  let s;
  try {
    s = await api.summary(c.flavour, c.region, c.realmSlug, c.nameKey);
  } catch (err) {
    const answer = err instanceof BnetError && err.status === 404 ? "not_found" : "error";
    if (answer === "error") log.warn("character.refresh.failed", { id: c.id, err: String(err) });
    const { next, event } = availabilityStep(prevAvail, answer);
    const [row] = await db
      .update(characters)
      .set({
        status: next.status,
        missingReportedAt: next.missingReported ? (c.missingReportedAt ?? new Date()) : null,
        fetchedAt: new Date(),
      })
      .where(eq(characters.id, c.id))
      .returning();
    if (event) await recordEvents(row, [event]);
    return row;
  }
  const back = availabilityStep(prevAvail, "ok").event; // "found", for a reported-missing character

  const unchanged =
    !force &&
    c.snapshotVersion >= SNAPSHOT_VERSION &&
    c.status === "ok" &&
    c.fetchedAt != null &&
    (s.last_login_timestamp ?? 0) === (c.lastLoginAt?.getTime() ?? 0) &&
    s.is_ghost === c.isGhost;
  if (unchanged) {
    // Blizzard renders the full-body image some time after a logout, and only
    // for recently played characters: keep asking (1 request) for a few days.
    let render: { avatarUrl?: string | null; renderUrl?: string | null } = {};
    const recent = c.lastLoginAt != null && Date.now() - c.lastLoginAt.getTime() < RENDER_WAIT_MS;
    if (!c.renderUrl && recent) {
      const media = await api.media(c.flavour, c.region, c.realmSlug, c.nameKey).catch(() => null);
      const m = media ? fromSummary(s, media) : null;
      if (m?.renderUrl) render = { avatarUrl: m.avatarUrl ?? c.avatarUrl, renderUrl: m.renderUrl };
    }
    const [row] = await db
      .update(characters)
      .set({ ...render, fetchedAt: new Date() })
      .where(eq(characters.id, c.id))
      .returning();
    return row;
  }

  const [equipment, specs, stats, media] = await Promise.all([
    api.equipment(c.flavour, c.region, c.realmSlug, c.nameKey).catch(() => null),
    api.specializations(c.flavour, c.region, c.realmSlug, c.nameKey).catch(() => null),
    api.statistics(c.flavour, c.region, c.realmSlug, c.nameKey).catch(() => null),
    api.media(c.flavour, c.region, c.realmSlug, c.nameKey).catch(() => null),
  ]);
  const base = fromSummary(s, media);
  const icons = await iconsFor(c, (equipment?.equipped_items ?? []).map((i) => i.item.id));
  const next = {
    ...base,
    // Keep the last good parts when a sub-request failed, rather than wiping them.
    equipment: equipment ? fromEquipment(equipment, icons) : c.equipment,
    talents: specs ? fromSpecializations(specs) : c.talents,
    stats: stats ? fromStatistics(stats) : c.stats,
    avatarUrl: base.avatarUrl ?? c.avatarUrl,
    renderUrl: base.renderUrl ?? c.renderUrl,
  };

  // Events only once we have a previous snapshot to compare with. For
  // characters that run the addon, the addon's own (exact, timestamped) events
  // win: the diff only keeps what the addon can't see.
  const diffed = c.fetchedAt && c.equipment.length + c.level > 0 ? diffSnapshots(c, next) : [];
  const events: EventData[] = [
    ...(back ? [back] : []),
    ...(c.addon && Date.now() - Date.parse(c.addon.syncedAt) < ADDON_STALE_MS ? diffed.filter((e) => !ADDON_COVERS.has(e.type)) : diffed),
  ];

  const [row] = await db
    .update(characters)
    .set({
      ...next,
      deadAt: next.isGhost ? (c.deadAt ?? new Date()) : null,
      // Characters tracked before categories existed pick theirs up here.
      realmCategory: c.realmCategory || (await realmCategory(c.region, c.flavour, c.realmSlug)),
      status: "ok",
      missingReportedAt: null,
      snapshotVersion: SNAPSHOT_VERSION,
      fetchedAt: new Date(),
    })
    .where(eq(characters.id, c.id))
    .returning();

  await recordEvents(row, events);
  return row;
}

/** One poller tick: refresh the characters that are due, oldest first. */
export async function refreshDue(limit = 60): Promise<{ checked: number }> {
  const now = Date.now();
  const due = await db
    .select()
    .from(characters)
    .where(
      and(
        gt(characters.requestedAt, new Date(now - DORMANT_AFTER_MS)),
        or(
          isNull(characters.fetchedAt),
          sql`${characters.snapshotVersion} < ${SNAPSHOT_VERSION} and ${characters.status} = 'ok'`,
          // Living characters, and ones with a first "not found" to confirm,
          // at the normal cadence; fallen and confirmed-missing ones daily.
          and(
            sql`${characters.isGhost} = false and (${characters.status} = 'ok' or ${characters.status} = 'error' or (${characters.status} = 'not_found' and ${characters.missingReportedAt} is null))`,
            lt(characters.fetchedAt, new Date(now - REFRESH_EVERY_MS)),
          ),
          lt(characters.fetchedAt, new Date(now - SLOW_REFRESH_MS)),
        ),
      ),
    )
    .orderBy(asc(characters.fetchedAt))
    .limit(limit);
  for (const c of due) await refreshCharacter(c);
  return { checked: due.length };
}

/** Retry pushes that failed everywhere, while they're still news (1 day). */
export async function notifyPending(): Promise<{ fired: number }> {
  const pending = await db
    .select({ e: characterEvents, c: characters })
    .from(characterEvents)
    .innerJoin(characters, eq(characters.id, characterEvents.characterId))
    .where(and(isNull(characterEvents.notifiedAt), gt(characterEvents.at, new Date(Date.now() - 86400_000))))
    .limit(30);
  let fired = 0;
  for (const { e, c } of pending) {
    const r = await deliverEvent(c, e);
    if (r.sent > 0 || r.targets === 0) await db.update(characterEvents).set({ notifiedAt: new Date() }).where(eq(characterEvents.id, e.id));
    if (r.sent > 0) fired++;
  }
  return { fired };
}
