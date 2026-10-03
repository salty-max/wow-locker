import type { CharacterSummary } from "@wow-locker/shared";
import { restedNow } from "@/lib/addonView";

/**
 * The Today overview (pure, tested): across the roster, what needs you now
 * (a craft off cooldown, a fully rested character, new or expiring mail) and
 * what comes up in the next days, from each character's last addon save.
 */

export type TodayItem = {
  characterId: number;
  kind: "cooldown" | "rested" | "newMail" | "mailExpires";
  /** cooldown: the craft; mailExpires: the letter count */
  detail: string | null;
  count?: number;
  returned?: boolean;
  /** When it happens (null: already). */
  at: string | null;
  /** Mail about to be lost: shown in red. */
  urgent?: boolean;
};

const UPCOMING_MS = 7 * 86400_000;
const URGENT_MS = 86400_000;

export type TodayView = {
  needsYou: TodayItem[];
  upcoming: TodayItem[];
  gold: number | null;
  played: number | null;
  /** Characters with addon data. */
  tracked: number;
};

export function todayView(chars: CharacterSummary[], now = Date.now()): TodayView {
  const needsYou: TodayItem[] = [];
  const upcoming: TodayItem[] = [];
  let gold: number | null = null;
  let played: number | null = null;
  let tracked = 0;
  const soon = (iso: string) => Date.parse(iso) - now <= UPCOMING_MS;

  for (const c of chars) {
    const d = c.today;
    if (!d) continue;
    tracked++;
    if (d.money != null) gold = (gold ?? 0) + d.money;
    if (d.played != null) played = (played ?? 0) + d.played;
    if (c.isGhost) continue; // the fallen need nothing any more

    for (const cd of d.cooldowns) {
      const item = { characterId: c.id, kind: "cooldown" as const, detail: cd.name };
      if (Date.parse(cd.readyAt) <= now) needsYou.push({ ...item, at: null });
      else if (soon(cd.readyAt)) upcoming.push({ ...item, at: cd.readyAt });
    }

    if (d.xp != null && d.xpMax) {
      const rest = restedNow({ xp: d.xp, max: d.xpMax, rested: d.rested, resting: d.resting }, { level: c.level, flavour: c.flavour, savedAt: d.savedAt, now });
      if (rest?.full) needsYou.push({ characterId: c.id, kind: "rested", detail: null, at: null });
      else if (rest?.fullAt && soon(rest.fullAt.toISOString())) upcoming.push({ characterId: c.id, kind: "rested", detail: null, at: rest.fullAt.toISOString() });
    }

    if (d.mail?.hasNew) needsYou.push({ characterId: c.id, kind: "newMail", detail: null, at: null });
    if (d.mail?.nextExpiry) {
      const item: TodayItem = {
        characterId: c.id,
        kind: "mailExpires",
        detail: null,
        count: d.mail.letters,
        returned: d.mail.nextOnExpiry === "returned",
        at: d.mail.nextExpiry,
      };
      if (Date.parse(d.mail.nextExpiry) - now <= URGENT_MS) needsYou.push({ ...item, urgent: true });
      else if (soon(d.mail.nextExpiry)) upcoming.push(item);
    }
  }

  // Urgent first, then by character order; what's coming by time.
  needsYou.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  upcoming.sort((a, b) => a.at!.localeCompare(b.at!));
  return { needsYou, upcoming, gold, played, tracked };
}

/** How full the rested bar is now (0–1.5 of a level), for the characters table. */
export function restedShare(c: CharacterSummary, now = Date.now()): number | null {
  const d = c.today;
  if (!d || d.xp == null || !d.xpMax || c.isGhost) return null;
  const rest = restedNow({ xp: d.xp, max: d.xpMax, rested: d.rested, resting: d.resting }, { level: c.level, flavour: c.flavour, savedAt: d.savedAt, now });
  return rest ? rest.rested / d.xpMax : null;
}
