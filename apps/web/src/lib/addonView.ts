import type { AddonState, CharacterDetail, Flavour, Lang } from "@wow-locker/shared";

/**
 * What the character page shows from the in-game addon's data (pure, tested).
 * The addon's numbers are exact but only as fresh as its last save (logout or
 * /reload); Battle.net's are refreshed at logout too. Whichever is newer wins.
 */

const MAX_LEVEL: Record<Flavour, number> = { classic1x: 60, classicann: 70, classic: 90 };

export type XpView = { xp: number; max: number; rested: number | null; resting: boolean | null };

/** The XP to show: the addon's (with rested) when it's at least as recent as Battle.net's. */
export function xpView(c: Pick<CharacterDetail, "experience" | "xpToNext" | "lastLoginAt" | "addon">): XpView | null {
  const a = c.addon;
  const addonUsable = a?.xpMax != null && a.xp != null && a.updatedAt != null;
  const addonFresh =
    addonUsable && (!c.lastLoginAt || new Date(a!.updatedAt!).getTime() >= new Date(c.lastLoginAt).getTime() - 5 * 60_000);
  if (addonFresh) return { xp: a!.xp!, max: a!.xpMax!, rested: a!.rested, resting: a!.resting };
  if (c.xpToNext) return { xp: c.experience, max: c.xpToNext, rested: null, resting: null };
  return null;
}

/**
 * Rested XP now, projected from the last save: Classic gives 5% of the level's
 * bar every 8 hours in an inn or city (a quarter of that elsewhere), up to 150%.
 */
export function restedNow(
  v: XpView,
  opts: { level: number; flavour: Flavour; savedAt: string | null; now?: number },
): { rested: number; full: boolean; fullAt: Date | null } | null {
  if (v.rested == null || opts.level >= MAX_LEVEL[opts.flavour]) return null;
  const cap = 1.5 * v.max;
  const now = opts.now ?? Date.now();
  const perMs = (0.05 * v.max) / (8 * 3600_000) / (v.resting ? 1 : 4);
  const since = opts.savedAt ? Math.max(0, now - new Date(opts.savedAt).getTime()) : 0;
  const rested = Math.min(cap, v.rested + since * perMs);
  const full = rested >= cap - 1;
  const fullAt = full ? null : new Date(now + (cap - rested) / perMs);
  return { rested: Math.round(rested), full, fullAt };
}

/** Played time the way /played reads: "4d 3h", "3h 12m" ("4 j 3 h" in French). */
export function played(seconds: number, lang: Lang): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (lang === "fr") return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Gold, unless it's the 0 the very first addon version saved before reading it. */
export function knownMoney(a: AddonState): number | null {
  if (a.money == null) return null;
  if (a.money === 0 && a.xpMax == null) return null;
  return a.money;
}

// The game's skill sections, in its order (English and French clients).
const SECTION_ORDER = [
  ["Professions", "Métiers"],
  ["Secondary Skills", "Compétences secondaires"],
  ["Weapon Skills", "Compétences d'armes", "Armes"],
];
// Always at their maximum: noise next to professions and weapons.
const HIDDEN_SECTIONS = new Set([
  "Class Skills",
  "Armor Proficiencies",
  "Languages",
  "Compétences de classe",
  "Armures",
  "Maîtrise des armures",
  "Langues",
]);

export type SkillSection = { name: string; skills: AddonState["skills"] };

export function skillSections(skills: AddonState["skills"]): SkillSection[] {
  const bySection = new Map<string, AddonState["skills"]>();
  for (const s of skills) {
    const section = s.section ?? "";
    if (HIDDEN_SECTIONS.has(section) || s.max <= 1) continue;
    bySection.set(section, [...(bySection.get(section) ?? []), s]);
  }
  const rank = (name: string) => {
    const i = SECTION_ORDER.findIndex((names) => names.includes(name));
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return [...bySection.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, list]) => ({ name, skills: [...list].sort((x, y) => y.rank - x.rank || x.name.localeCompare(y.name)) }));
}

/** Standing 1 (Hated) … 8 (Exalted): the game's labels and bar colours (FACTION_BAR_COLORS). */
export const STANDINGS: { en: string; fr: string; color: string }[] = [
  { en: "Hated", fr: "Haï", color: "#cc4d38" },
  { en: "Hostile", fr: "Hostile", color: "#cc4d38" },
  { en: "Unfriendly", fr: "Inamical", color: "#bf4500" },
  { en: "Neutral", fr: "Neutre", color: "#e6b300" },
  { en: "Friendly", fr: "Amical", color: "#009919" },
  { en: "Honored", fr: "Honoré", color: "#009919" },
  { en: "Revered", fr: "Révéré", color: "#009919" },
  { en: "Exalted", fr: "Exalté", color: "#009919" },
];

export function standing(id: number) {
  return STANDINGS[Math.min(8, Math.max(1, id)) - 1];
}

export function sortedReputations(reps: AddonState["reputations"]): AddonState["reputations"] {
  return [...reps].sort((a, b) => b.standing - a.standing || b.value / (b.max || 1) - a.value / (a.max || 1) || a.name.localeCompare(b.name));
}

export type LevelRow = { level: number; played: number; took: number | null };

/** /played when each level was reached, and how long the level before took. */
export function levelling(levelPlayed: Record<string, number>): LevelRow[] {
  const rows = Object.entries(levelPlayed)
    .map(([level, p]) => ({ level: Number(level), played: p }))
    .filter((r) => Number.isFinite(r.level))
    .sort((a, b) => b.level - a.level);
  return rows.map((r, i) => {
    const prev = rows[i + 1];
    return { ...r, took: prev && prev.level === r.level - 1 ? r.played - prev.played : null };
  });
}
