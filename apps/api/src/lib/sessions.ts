import type { EventData, EventSource, Flavour, Quality, SessionRecap } from "@wow-locker/shared";
import { xpToNext } from "@/lib/classic";

/**
 * Play sessions, rebuilt from the addon's login / logout events: what each one
 * brought (levels, XP, gold, quests, loot, danger). A /reload records a logout
 * and a login seconds apart: a login this soon after a logout continues the
 * same session, so only the last logout gets a recap.
 */
export const RELOAD_GAP_MS = 3 * 60_000;

export type SessionEvent = { id: number; at: Date; source: EventSource; data: EventData };

const NOTABLE = new Set<Quality>(["rare", "epic", "legendary", "artifact"]);
const MAX_LOOT = 6;

type Acc = {
  start: SessionEvent & { data: Extract<EventData, { type: "session" }> };
  quests: number;
  loot: SessionRecap["loot"];
  deaths: number;
  closeCalls: number;
  lowest: number | null;
  dungeons: Set<string>;
  skillUps: number;
  reputations: number;
};

/** XP earned between two (level, xp) points, through the flavour's level table. */
export function xpBetween(flavour: Flavour, from: { level: number; xp: number }, to: { level: number; xp: number }): number | null {
  if (to.level < from.level) return null;
  if (to.level === from.level) return Math.max(0, to.xp - from.xp);
  const first = xpToNext(flavour, from.level);
  if (first == null) return null;
  let total = first - from.xp;
  for (let l = from.level + 1; l < to.level; l++) {
    const n = xpToNext(flavour, l);
    if (n == null) return null;
    total += n;
  }
  return Math.max(0, total + to.xp);
}

/**
 * Recap per logout event id, for the sessions that are over: events oldest
 * first. The last logout counts as over once `now` is past the reload gap.
 */
export function sessionRecaps(events: SessionEvent[], flavour: Flavour, now = Date.now()): Map<number, SessionRecap> {
  const out = new Map<number, SessionRecap>();
  let acc: Acc | null = null;
  let logout: (SessionEvent & { data: Extract<EventData, { type: "session" }> }) | null = null;

  const close = () => {
    if (acc && logout) out.set(logout.id, recap(acc, logout, flavour));
    acc = null;
    logout = null;
  };

  for (const e of events) {
    const d = e.data;
    if (logout && e.at.getTime() - logout.at.getTime() > RELOAD_GAP_MS) close();
    if (d.type === "session") {
      if (d.action === "logout") {
        if (acc) logout = { ...e, data: d };
      } else if (logout) {
        logout = null; // a /reload: same session
      } else {
        // A new session (also after a login with no logout: the game crashed).
        acc = { start: { ...e, data: d }, quests: 0, loot: [], deaths: 0, closeCalls: 0, lowest: null, dungeons: new Set(), skillUps: 0, reputations: 0 };
      }
      continue;
    }
    if (!acc || e.source !== "addon") continue;
    const a: Acc = acc;
    switch (d.type) {
      case "quest":
        if (d.action !== "accept") a.quests++;
        break;
      case "loot":
        if (NOTABLE.has(d.quality) && a.loot.length < MAX_LOOT) a.loot.push({ itemId: d.itemId, name: d.name, quality: d.quality, count: d.count });
        break;
      case "death":
        a.deaths++;
        break;
      case "closeCall":
        a.closeCalls++;
        a.lowest = a.lowest == null ? d.pct : Math.min(a.lowest, d.pct);
        break;
      case "dungeon":
        if (d.action === "enter") a.dungeons.add(d.name);
        break;
      case "skill":
        a.skillUps++;
        break;
      case "reputation":
        a.reputations++;
        break;
    }
  }
  if (logout && now - (logout as SessionEvent).at.getTime() > RELOAD_GAP_MS) close();
  return out;
}

function recap(a: Acc, end: SessionEvent & { data: Extract<EventData, { type: "session" }> }, flavour: Flavour): SessionRecap {
  const s = a.start.data;
  const e = end.data;
  const xp = s.xp != null && e.xp != null ? xpBetween(flavour, { level: s.level, xp: s.xp }, { level: e.level, xp: e.xp }) : null;
  return {
    start: a.start.at.toISOString(),
    end: end.at.toISOString(),
    duration: Math.round((end.at.getTime() - a.start.at.getTime()) / 1000),
    levelFrom: s.level,
    levelTo: e.level,
    xp,
    money: s.money != null && e.money != null ? e.money - s.money : null,
    quests: a.quests,
    loot: a.loot,
    deaths: a.deaths,
    closeCalls: a.closeCalls,
    lowest: a.lowest,
    dungeons: [...a.dungeons],
    skillUps: a.skillUps,
    reputations: a.reputations,
  };
}
