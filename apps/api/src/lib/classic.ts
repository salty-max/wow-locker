import type { ClassKey, Faction, Flavour, Quality } from "@wow-locker/shared";

/** playable-class ids → our keys (same ids in every flavour). */
const CLASS_IDS: Record<number, ClassKey> = {
  1: "warrior",
  2: "paladin",
  3: "hunter",
  4: "rogue",
  5: "priest",
  6: "deathknight",
  7: "shaman",
  8: "mage",
  9: "warlock",
  10: "monk",
  11: "druid",
  12: "demonhunter",
  13: "evoker",
};
export const classKeyOf = (id: number | undefined): ClassKey | null => (id != null ? (CLASS_IDS[id] ?? null) : null);

export function factionOf(type: string | undefined): Faction {
  const t = (type ?? "").toLowerCase();
  return t === "alliance" || t === "horde" ? t : "neutral";
}

const QUALITIES: Quality[] = ["poor", "common", "uncommon", "rare", "epic", "legendary", "artifact", "heirloom"];
export function qualityOf(type: string | undefined): Quality {
  const q = (type ?? "").toLowerCase() as Quality;
  return QUALITIES.includes(q) ? q : "common";
}

/**
 * XP to go from level N to N+1 in Classic Era (unchanged vanilla table, which
 * Era / Hardcore / SoD realms use). Index = current level. Other flavours
 * changed the curve (TBC 2.3 cut 20–60, MoP is different again), so we only
 * claim the one we know: null elsewhere, and the UI shows the level alone.
 */
const ERA_XP: number[] = [
  0, 400, 900, 1400, 2100, 2800, 3600, 4500, 5400, 6500, 7600, 8800, 10100, 11400, 12900, 14400, 16000, 17700, 19400,
  21300, 23200, 25200, 27300, 29400, 31700, 34000, 36400, 38900, 41400, 44300, 47400, 50800, 54500, 58600, 62800, 67100,
  71600, 76100, 80800, 85700, 90700, 95800, 101000, 106300, 111800, 117500, 123200, 129100, 135100, 141200, 147500, 153900,
  160400, 167100, 173900, 180800, 187900, 195000, 202300, 209800,
];

export function xpToNext(flavour: Flavour, level: number): number | null {
  if (flavour !== "classic1x") return null;
  return ERA_XP[level] ?? null; // null at 60 (max) or beyond
}

/** Equipment display order (paper doll, left column then right, then weapons). */
export const SLOT_ORDER = [
  "HEAD",
  "NECK",
  "SHOULDER",
  "BACK",
  "CHEST",
  "SHIRT",
  "TABARD",
  "WRIST",
  "HANDS",
  "WAIST",
  "LEGS",
  "FEET",
  "FINGER_1",
  "FINGER_2",
  "TRINKET_1",
  "TRINKET_2",
  "MAIN_HAND",
  "OFF_HAND",
  "RANGED",
];

/** Cosmetic slots: changes there are not worth an event. */
export const COSMETIC_SLOTS = new Set(["SHIRT", "TABARD"]);
