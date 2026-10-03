import { describe, expect, it } from "bun:test";
import type { CharacterSummary, TodayInfo } from "@wow-locker/shared";
import { restedShare, todayView } from "@/lib/todayView";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();

const today = (over: Partial<TodayInfo> = {}): TodayInfo => ({
  savedAt: h(0),
  xp: 0,
  xpMax: 10000,
  rested: 0,
  resting: true,
  money: 10000,
  played: 3600,
  zone: "Darkshore",
  bags: { used: 10, total: 20 },
  mail: null,
  cooldowns: [],
  ...over,
});

const char = (id: number, over: Partial<CharacterSummary> = {}): CharacterSummary => ({
  id,
  region: "eu",
  flavour: "classic1x",
  realmSlug: "soulseeker",
  realmName: "Soulseeker",
  realmCategory: "",
  name: `C${id}`,
  level: 20,
  experience: 0,
  xpToNext: 10000,
  race: "Human",
  className: "Mage",
  classKey: "mage",
  gender: "",
  faction: "alliance",
  guild: null,
  isGhost: false,
  isSelfFound: false,
  itemLevel: null,
  avatarUrl: null,
  renderUrl: null,
  lastLoginAt: null,
  deadAt: null,
  status: "ok",
  fetchedAt: null,
  lastEventAt: null,
  addonSyncedAt: null,
  today: today(),
  ...over,
});

describe("todayView", () => {
  it("sorts what needs you now from what comes up this week", () => {
    const v = todayView(
      [
        char(1, {
          today: today({
            rested: 13000, // full in 32 h
            cooldowns: [
              { name: "Mooncloth", readyAt: h(-1) },
              { name: "Transmute", readyAt: h(30) },
              { name: "Far away", readyAt: h(24 * 9) },
            ],
            mail: { letters: 2, hasNew: true, nextExpiry: h(5), nextOnExpiry: "returned" },
          }),
        }),
        char(2, { today: today({ rested: 15000 }) }), // full
        char(3, { today: null }),
      ],
      NOW,
    );
    expect(v.needsYou.map((i) => [i.characterId, i.kind])).toEqual([
      [1, "mailExpires"], // urgent first
      [1, "cooldown"],
      [1, "newMail"],
      [2, "rested"],
    ]);
    // Character 1 isn't full yet: its rested bar fills within the week.
    expect(v.upcoming.map((i) => [i.characterId, i.kind, i.detail])).toEqual([
      [1, "cooldown", "Transmute"],
      [1, "rested", null],
    ]);
    expect(v.gold).toBe(20000);
    expect(v.tracked).toBe(2);
  });

  it("asks nothing of the fallen, but counts their gold", () => {
    const v = todayView([char(1, { isGhost: true, today: today({ cooldowns: [{ name: "x", readyAt: h(-1) }] }) })], NOW);
    expect(v.needsYou).toEqual([]);
    expect(v.gold).toBe(10000);
  });
});

describe("restedShare", () => {
  it("projects the rested bar from the last save", () => {
    expect(restedShare(char(1, { today: today({ rested: 5000, savedAt: h(-8) }) }), NOW)).toBeCloseTo(0.55);
    expect(restedShare(char(1, { today: null }), NOW)).toBeNull();
  });
});
