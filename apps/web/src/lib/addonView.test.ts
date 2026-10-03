import { describe, expect, it } from "bun:test";
import type { AddonState } from "@wow-locker/shared";
import { knownMoney, levelling, played, restedNow, skillSections, sortedReputations, xpView } from "@/lib/addonView";

const state = (over: Partial<AddonState> = {}): AddonState => ({
  syncedAt: "2026-10-02T20:25:19Z",
  updatedAt: "2026-10-02T20:25:16Z",
  xp: 675,
  xpMax: 17700,
  rested: 26550,
  resting: true,
  money: 10190,
  playedTotal: 39331,
  playedLevel: 209,
  zone: "Darkshore",
  subZone: "Auberdine",
  x: 37.3,
  y: 43.8,
  hardcore: true,
  levelPlayed: {},
  questsCompleted: 106,
  skills: [],
  reputations: [],
  mail: null,
  cooldowns: [],
  run: null,
  bags: [],
  bank: null,
  mapId: null,
  pet: null,
  stable: null,
  ...over,
});

describe("xpView", () => {
  it("uses the addon's XP and rested when it's as recent as Battle.net's", () => {
    const v = xpView({ experience: 100, xpToNext: 17700, lastLoginAt: "2026-10-02T20:25:00Z", addon: state() });
    expect(v).toEqual({ xp: 675, max: 17700, rested: 26550, resting: true });
  });
  it("falls back to Battle.net when the addon's save is older", () => {
    const v = xpView({ experience: 900, xpToNext: 17700, lastLoginAt: "2026-10-05T10:00:00Z", addon: state() });
    expect(v).toEqual({ xp: 900, max: 17700, rested: null, resting: null });
  });
  it("ignores an addon save without XP (the first version zeroed it)", () => {
    const v = xpView({ experience: 900, xpToNext: 17700, lastLoginAt: null, addon: state({ xp: 0, xpMax: null }) });
    expect(v?.xp).toBe(900);
  });
});

describe("restedNow", () => {
  const v = { xp: 0, max: 10000, rested: 0, resting: true };
  it("grows 5% of the bar per 8 h in an inn, up to 150%", () => {
    const saved = "2026-10-01T00:00:00Z";
    const r = restedNow(v, { level: 20, flavour: "classic1x", savedAt: saved, now: Date.parse(saved) + 8 * 3600_000 });
    expect(r?.rested).toBe(500);
    expect(r?.full).toBe(false);
    const later = restedNow(v, { level: 20, flavour: "classic1x", savedAt: saved, now: Date.parse(saved) + 300 * 86400_000 });
    expect(later).toMatchObject({ rested: 15000, full: true, fullAt: null });
  });
  it("is four times slower outside an inn, and nothing at max level", () => {
    const saved = "2026-10-01T00:00:00Z";
    const r = restedNow({ ...v, resting: false }, { level: 20, flavour: "classic1x", savedAt: saved, now: Date.parse(saved) + 8 * 3600_000 });
    expect(r?.rested).toBe(125);
    expect(restedNow(v, { level: 60, flavour: "classic1x", savedAt: saved })).toBeNull();
  });
});

describe("formatting", () => {
  it("reads like /played", () => {
    expect(played(39331, "en")).toBe("10h 55m");
    expect(played(98281, "en")).toBe("1d 3h");
    expect(played(98281, "fr")).toBe("1 j 3 h");
  });
  it("hides the 0 gold of the first addon version", () => {
    expect(knownMoney(state({ money: 0, xpMax: null }))).toBeNull();
    expect(knownMoney(state())).toBe(10190);
  });
});

describe("skills and reputation", () => {
  it("orders professions first and drops always-maxed sections", () => {
    const sections = skillSections([
      { name: "Maces", section: "Weapon Skills", rank: 1, max: 85 },
      { name: "Protection", section: "Class Skills", rank: 85, max: 85 },
      { name: "Shield", section: "Armor Proficiencies", rank: 1, max: 1 },
      { name: "Cooking", section: "Secondary Skills", rank: 81, max: 150 },
      { name: "Mining", section: "Professions", rank: 77, max: 150 },
    ]);
    expect(sections.map((s) => s.name)).toEqual(["Professions", "Secondary Skills", "Weapon Skills"]);
  });
  it("sorts reputations by standing, then progress", () => {
    const reps = sortedReputations([
      { name: "Darnassus", standing: 5, value: 898, max: 6000 },
      { name: "Ironforge", standing: 5, value: 5228, max: 6000 },
      { name: "Booty Bay", standing: 4, value: 100, max: 3000 },
    ]);
    expect(reps.map((r) => r.name)).toEqual(["Ironforge", "Darnassus", "Booty Bay"]);
  });
  it("works out how long each level took", () => {
    expect(levelling({ "21": 80000, "22": 86400, "23": 90000 })).toEqual([
      { level: 23, played: 90000, took: 3600 },
      { level: 22, played: 86400, took: 6400 },
      { level: 21, played: 80000, took: null },
    ]);
  });
});
