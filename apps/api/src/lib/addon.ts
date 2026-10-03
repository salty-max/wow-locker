import type { AddonState, Container, EventData, Flavour, Quality, ReminderKind, TalentTree } from "@wow-locker/shared";

/**
 * The in-game addon's data (WowLockerDB, converted from Lua to JSON by the
 * companion) → our timeline events, state and offline reminders. Pure: no DB.
 *
 * The data comes from a user's machine: every field is checked and clamped,
 * anything malformed is dropped rather than trusted.
 */

const MAX_EVENTS = 5000;
const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** "Player-6113-03D658B8" → realm 6113, character 64379064 (the Battle.net API ids). */
export function parseGuid(guid: string): { realmId: number; characterId: number } | null {
  const m = /^Player-(\d+)-([0-9A-Fa-f]{1,16})$/.exec(guid);
  if (!m) return null;
  const characterId = parseInt(m[2], 16);
  return Number.isSafeInteger(characterId) ? { realmId: Number(m[1]), characterId } : null;
}

const QUALITY_BY_COLOR: Record<string, Quality> = {
  "9d9d9d": "poor",
  ffffff: "common",
  "1eff00": "uncommon",
  "0070dd": "rare",
  a335ee: "epic",
  ff8000: "legendary",
  e6cc80: "artifact",
};
const qualityOf = (color: unknown): Quality => QUALITY_BY_COLOR[(str(color) ?? "").toLowerCase()] ?? "common";
const QUALITY_BY_NUMBER: Quality[] = ["poor", "common", "uncommon", "rare", "epic", "legendary", "artifact", "heirloom"];

function trees(v: unknown): TalentTree[] {
  return arr(v)
    .map(obj)
    .map((t) => ({ name: str(t.name, 60) ?? "", points: int(t.points) ?? 0 }))
    .filter((t) => t.name);
}

/**
 * Fields the addon updates in place after recording (a close call's lowest
 * health, the /played answer stamped on a level-up): left out of the key, or a
 * /reload between the two writes would upload the same event twice.
 */
const MUTABLE: Record<string, string[]> = { close_call: ["pct"], level: ["played"] };

/** Stable, order-independent key for an addon event: re-uploads dedupe on it. */
function dedupeKey(raw: Record<string, unknown>): string {
  const skip = MUTABLE[String(raw.type)] ?? [];
  const parts = Object.keys(raw)
    .filter((k) => !skip.includes(k))
    .sort()
    .map((k) => `${k}=${typeof raw[k] === "object" ? JSON.stringify(raw[k]) : String(raw[k])}`);
  let h = 2166136261; // FNV-1a
  for (const ch of parts.join("|")) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `a:${int(raw.t)}:${str(raw.type, 20)}:${h.toString(36)}`;
}

/** One raw addon event → our event data (null: dropped). */
export function mapEvent(raw: Record<string, unknown>): EventData | null {
  switch (raw.type) {
    case "login":
    case "logout":
      return { type: "session", action: raw.type, level: int(raw.level) ?? 0 };
    case "gear": {
      const slot = str(raw.slot, 20);
      if (!slot) return null;
      const name = str(raw.name);
      return {
        type: "gear",
        changes: [{ slot, slotName: slot, from: null, to: name, quality: name ? qualityOf(raw.color) : null }],
      };
    }
    case "level": {
      const level = int(raw.level);
      if (level == null) return null;
      return { type: "level", from: level - 1, to: level, ...(int(raw.played) != null ? { played: int(raw.played)! } : {}) };
    }
    case "talent":
      return { type: "talent", trees: trees(raw.trees) };
    case "respec":
      return { type: "respec", from: [], to: trees(raw.trees) };
    case "guild":
      return { type: "guild", from: str(raw.from, 60), to: str(raw.to, 60) };
    case "death":
      return {
        type: "death",
        level: int(raw.level) ?? 0,
        killer: str(raw.killer, 80),
        spell: str(raw.spell, 80),
        environmental: bool(raw.environmental) ?? false,
        zone: str(raw.zone, 80),
        subZone: str(raw.subZone, 80),
        x: num(raw.x),
        y: num(raw.y),
        instance: str(raw.instance, 80),
      };
    case "quest": {
      const questId = int(raw.questId);
      if (questId == null) return null;
      return { type: "quest", action: "complete", questId, title: str(raw.title, 120), xp: int(raw.xp) ?? 0, money: int(raw.money) ?? 0 };
    }
    case "quest_accept": {
      const questId = int(raw.questId);
      if (questId == null) return null;
      return { type: "quest", action: "accept", questId, title: str(raw.title, 120), xp: 0, money: 0, level: int(raw.level) };
    }
    case "close_call":
      return {
        type: "closeCall",
        pct: Math.max(0, Math.min(100, int(raw.pct) ?? 0)),
        level: int(raw.level) ?? 0,
        attacker: str(raw.attacker, 80),
        spell: str(raw.spell, 80),
        zone: str(raw.zone, 80),
        subZone: str(raw.subZone, 80),
        instance: str(raw.instance, 80),
      };
    case "dungeon_enter":
    case "dungeon_leave": {
      const name = str(raw.name, 80);
      if (!name) return null;
      const group = arr(raw.group).flatMap((g) => (str(g, 40) ? [str(g, 40)!] : [])).slice(0, 40);
      return raw.type === "dungeon_enter"
        ? { type: "dungeon", action: "enter", name, kind: str(raw.kind, 10) ?? "party", group }
        : {
            type: "dungeon",
            action: "leave",
            name,
            kind: str(raw.kind, 10) ?? "party",
            group,
            duration: int(raw.duration) ?? 0,
            deaths: int(raw.deaths) ?? 0,
            closeCalls: int(raw.closeCalls) ?? 0,
          };
    }
    case "loot": {
      const itemId = int(raw.itemId);
      const name = str(raw.name);
      if (itemId == null || !name) return null;
      const how = raw.how === "received" || raw.how === "created" ? raw.how : "loot";
      return { type: "loot", itemId, name, quality: qualityOf(raw.color), count: Math.max(1, int(raw.count) ?? 1), how };
    }
    case "skill": {
      const name = str(raw.name, 60);
      if (!name) return null;
      return {
        type: "skill",
        name,
        section: str(raw.section, 60),
        rank: int(raw.rank) ?? 0,
        max: int(raw.max) ?? 0,
        learned: raw.learned === true,
      };
    }
    case "reputation": {
      const faction = str(raw.faction, 80);
      if (!faction) return null;
      return { type: "reputation", faction, standing: int(raw.standing) ?? 0, label: str(raw.label, 40) };
    }
    default:
      return null; // an event type this server doesn't know (newer addon): skip it
  }
}

/** Bags / bank containers, bounded: 12 containers, 40 slots each. */
function containers(v: unknown): Container[] {
  return arr(v)
    .map(obj)
    .flatMap((c) => {
      const size = int(c.size);
      if (size == null || size < 1 || size > 40) return [];
      const items = arr(c.items)
        .map(obj)
        .flatMap((it) => {
          const slot = int(it.slot);
          const itemId = int(it.id);
          const name = str(it.name);
          if (slot == null || slot < 1 || slot > size || itemId == null || !name) return [];
          const q = int(it.q);
          return [{ slot, itemId, name, count: Math.max(1, Math.min(10000, int(it.count) ?? 1)), quality: q != null && q >= 0 && q <= 7 ? q : null }];
        });
      return [{ bag: int(c.bag) ?? 0, name: str(c.name, 80), size, items }];
    })
    .slice(0, 12);
}

export type AddonEvent = { key: string; at: Date; data: EventData };

export type AddonCharacter = {
  guid: string;
  realmId: number;
  characterId: number;
  name: string;
  realm: string;
  events: AddonEvent[];
  state: Omit<AddonState, "syncedAt">;
};

const iso = (unix: number | null) => (unix != null ? new Date(unix * 1000).toISOString() : null);

/** Validate one uploaded character. Null when it can't be identified. */
export function parseAddonCharacter(guid: string, raw: unknown): AddonCharacter | null {
  const ids = parseGuid(guid);
  const c = obj(raw);
  const name = str(c.name, 12);
  if (!ids || !name) return null;

  const events: AddonEvent[] = [];
  // Identical events in the same second (two stacks of the same loot) are
  // both real: the n-th repeat gets a #n suffix, stable across uploads.
  const seen = new Map<string, number>();
  for (const e of arr(c.events).slice(-MAX_EVENTS)) {
    const r = obj(e);
    const t = int(r.t);
    if (t == null || t < 1_000_000_000 || t > Date.now() / 1000 + 86400) continue; // nonsense clocks
    const data = mapEvent(r);
    if (!data) continue;
    const base = dedupeKey(r);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    events.push({ key: n ? `${base}#${n}` : base, at: new Date(t * 1000), data });
  }

  const s = obj(c.state);
  const mail = obj(s.mail);
  const levelPlayed: Record<string, number> = {};
  for (const [lvl, played] of Object.entries(obj(s.levelPlayed))) {
    const p = int(played);
    if (/^\d{1,3}$/.test(lvl) && p != null) levelPlayed[lvl] = p;
  }
  const run = obj(s.run);
  return {
    guid,
    ...ids,
    name,
    realm: str(c.realm, 60) ?? "",
    events,
    state: {
      updatedAt: iso(int(s.updatedAt)),
      xp: int(s.xp),
      xpMax: int(s.xpMax) || null, // 0 = not loaded yet in game: unknown
      rested: int(s.rested),
      resting: bool(s.resting),
      money: int(s.money),
      playedTotal: int(s.playedTotal),
      playedLevel: int(s.playedLevel),
      zone: str(s.zone, 80),
      subZone: str(s.subZone, 80),
      x: num(s.x),
      y: num(s.y),
      hardcore: bool(s.hardcore),
      levelPlayed,
      questsCompleted: arr(s.questsCompleted).length,
      skills: arr(s.skills)
        .map(obj)
        .flatMap((k) => (str(k.name, 60) ? [{ name: str(k.name, 60)!, section: str(k.section, 60), rank: int(k.rank) ?? 0, max: int(k.max) ?? 0 }] : []))
        .slice(0, 100),
      reputations: arr(s.reputations)
        .map(obj)
        .flatMap((r) => (str(r.name, 80) ? [{ name: str(r.name, 80)!, standing: int(r.standing) ?? 0, value: int(r.value) ?? 0, max: int(r.max) ?? 0 }] : []))
        .slice(0, 200),
      mail: Object.keys(mail).length
        ? {
            readAt: iso(int(mail.readAt)),
            hasNew: mail.hasNew === true,
            letters: arr(mail.letters)
              .map(obj)
              .flatMap((l) => {
                const expiresAt = iso(int(l.expiresAt));
                if (!expiresAt) return [];
                return [
                  {
                    sender: str(l.sender, 60),
                    subject: str(l.subject, 120),
                    money: int(l.money) ?? 0,
                    items: arr(l.items)
                      .map(obj)
                      .flatMap((it) =>
                        str(it.name)
                          ? [{ name: str(it.name)!, itemId: int(it.itemId), count: Math.max(1, int(it.count) ?? 1), quality: int(it.quality) }]
                          : [],
                      )
                      .slice(0, 16),
                    expiresAt,
                    onExpiry: l.onExpiry === "returned" ? ("returned" as const) : ("deleted" as const),
                  },
                ];
              })
              .slice(0, 100),
          }
        : null,
      cooldowns: arr(s.cooldowns)
        .map(obj)
        .flatMap((cd) => {
          const readyAt = iso(int(cd.readyAt));
          if (!readyAt) return [];
          return [
            {
              name: str(cd.name, 80),
              ...(int(cd.spellId) != null ? { spellId: int(cd.spellId)! } : {}),
              ...(int(cd.itemId) != null ? { itemId: int(cd.itemId)! } : {}),
              readyAt,
            },
          ];
        })
        .slice(0, 30),
      run: str(run.name, 80) ? { name: str(run.name, 80)!, kind: str(run.kind, 10) ?? "party", startedAt: iso(int(run.startedAt)) ?? "" } : null,
      bags: containers(s.bags),
      bank: iso(int(obj(s.bank).at)) ? { at: iso(int(obj(s.bank).at))!, containers: containers(obj(s.bank).containers) } : null,
    },
  };
}

// ── offline reminders ────────────────────────────────────────────────────────

export type Reminder = { kind: ReminderKind; key: string; fireAt: Date; data: EventData };

export const MAIL_LEAD_MS = 24 * 3600_000;
const MAX_LEVEL: Record<Flavour, number> = { classic1x: 60, classicann: 70, classic: 90 };

/**
 * Classic rested XP: +5% of the current level's bar every 8 hours while
 * resting (inn, city), a quarter of that elsewhere, capped at 150% of the bar.
 */
export function restedFullAt(input: {
  level: number;
  flavour: Flavour;
  xpMax: number;
  rested: number;
  resting: boolean;
  loggedOutAt: Date;
}): Date | null {
  const { level, flavour, xpMax, rested, resting, loggedOutAt } = input;
  if (level >= MAX_LEVEL[flavour] || xpMax <= 0) return null;
  const cap = 1.5 * xpMax;
  if (rested >= cap) return null;
  const perSecond = (0.05 * xpMax) / (8 * 3600) / (resting ? 1 : 4);
  return new Date(loggedOutAt.getTime() + ((cap - rested) / perSecond) * 1000);
}

/** The reminders this character should get, given its addon data. */
export function computeReminders(input: {
  state: AddonCharacter["state"];
  level: number;
  xpMax: number | null;
  flavour: Flavour;
  loggedOut: boolean;
  now: Date;
}): Reminder[] {
  const { state, now } = input;
  const out: Reminder[] = [];

  // Mail with something worth saving, 24 h before it expires.
  for (const l of state.mail?.letters ?? []) {
    const expires = new Date(l.expiresAt);
    if (expires <= now || (l.items.length === 0 && l.money === 0)) continue;
    const fireAt = new Date(Math.max(now.getTime(), expires.getTime() - MAIL_LEAD_MS));
    out.push({
      kind: "mailExpiring",
      key: `${l.expiresAt}|${l.sender ?? ""}|${l.subject ?? ""}`,
      fireAt,
      data: {
        type: "reminder",
        kind: "mailExpiring",
        detail: l.subject ?? l.sender,
        count: l.items.reduce((n, i) => n + i.count, 0),
        onExpiry: l.onExpiry,
      },
    });
  }

  // Fully rested — only meaningful once the character is offline.
  if (input.loggedOut && state.rested != null && input.xpMax && state.updatedAt) {
    const full = restedFullAt({
      level: input.level,
      flavour: input.flavour,
      xpMax: input.xpMax,
      rested: state.rested,
      resting: state.resting === true,
      loggedOutAt: new Date(state.updatedAt),
    });
    if (full && full > now) {
      // One per logout: the row of a reminder that already fired stays (unique key).
      out.push({ kind: "rested", key: `rested|${state.updatedAt}`, fireAt: full, data: { type: "reminder", kind: "rested", detail: null } });
    }
  }

  // Timed crafts.
  for (const cd of state.cooldowns) {
    const ready = new Date(cd.readyAt);
    if (ready <= now) continue;
    out.push({
      kind: "cooldown",
      // One per cooldown cycle (readyAt to the minute: it's derived from GetTime()).
      key: `${cd.spellId ?? `item${cd.itemId}`}|${Math.round(ready.getTime() / 60_000)}`,
      fireAt: ready,
      data: { type: "reminder", kind: "cooldown", detail: cd.name },
    });
  }
  return out;
}

export { QUALITY_BY_NUMBER };
