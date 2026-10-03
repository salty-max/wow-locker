import { describe, expect, it } from "bun:test";
import type { EventData } from "@wow-locker/shared";
import { dangerStats } from "@/lib/dangers";
import { recapLine } from "@/lib/notify";
import { ogDescription, ogPage } from "@/lib/og";
import { sessionRecaps, xpBetween, type SessionEvent } from "@/lib/sessions";
import { todayInfo } from "@/lib/today";
import { toSummary } from "@/lib/tracker";

const T0 = Date.parse("2026-10-03T18:00:00Z");
let nextId = 1;
const ev = (min: number, data: EventData, source: SessionEvent["source"] = "addon"): SessionEvent => ({
  id: nextId++,
  at: new Date(T0 + min * 60_000),
  source,
  data,
});
const login = (min: number, level: number, xp?: number, money?: number) => ev(min, { type: "session", action: "login", level, xp, money });
const logout = (min: number, level: number, xp?: number, money?: number) => ev(min, { type: "session", action: "logout", level, xp, money });

describe("sessionRecaps", () => {
  it("sums up a session, /reloads merged", () => {
    const events = [
      login(0, 21, 1000, 50_000),
      ev(10, { type: "quest", action: "complete", questId: 1, title: "A", xp: 1200, money: 500 }),
      ev(12, { type: "quest", action: "accept", questId: 2, title: "B", xp: 0, money: 0 }),
      logout(20, 21, 9000, 52_000), // /reload
      login(20.2, 21, 9000, 52_000),
      ev(30, { type: "closeCall", pct: 18, level: 21, attacker: "Murloc", spell: null, zone: "Westfall", subZone: null, instance: null }),
      ev(31, { type: "closeCall", pct: 9, level: 21, attacker: "Murloc", spell: null, zone: "Westfall", subZone: null, instance: null }),
      ev(40, { type: "loot", itemId: 5, name: "Blue Sword", quality: "rare", count: 1, how: "loot" }),
      ev(41, { type: "loot", itemId: 6, name: "Linen", quality: "common", count: 4, how: "loot" }),
      ev(50, { type: "dungeon", action: "enter", name: "The Deadmines", kind: "party", group: [] }),
      ev(55, { type: "gear", changes: [] }, "api"), // not the addon's: ignored
      logout(72, 22, 500, 61_000),
    ];
    const recaps = sessionRecaps(events, "classic1x", T0 + 3 * 3600_000);
    expect(recaps.size).toBe(1);
    const r = recaps.get(events.at(-1)!.id)!;
    expect(r.duration).toBe(72 * 60);
    expect(r).toMatchObject({ levelFrom: 21, levelTo: 22, quests: 1, closeCalls: 2, lowest: 9, deaths: 0, money: 11_000 });
    expect(r.loot.map((l) => l.name)).toEqual(["Blue Sword"]);
    expect(r.dungeons).toEqual(["The Deadmines"]);
    expect(r.xp).toBe(xpBetween("classic1x", { level: 21, xp: 1000 }, { level: 22, xp: 500 }));
  });

  it("waits out the reload gap before calling the last logout the end", () => {
    const events = [login(0, 10), logout(30, 10)];
    expect(sessionRecaps(events, "classic1x", T0 + 31 * 60_000).size).toBe(0);
    expect(sessionRecaps(events, "classic1x", T0 + 34 * 60_000).size).toBe(1);
  });

  it("starts over after a crash (a login with no logout before it)", () => {
    const events = [login(0, 10), ev(5, { type: "quest", questId: 1, title: null, xp: 0, money: 0 }), login(60, 10), logout(90, 10)];
    const r = [...sessionRecaps(events, "classic1x", T0 + 5 * 3600_000).values()];
    expect(r).toHaveLength(1);
    expect(r[0].quests).toBe(0);
    expect(r[0].duration).toBe(30 * 60);
  });

  it("leaves gold and XP unknown for older addon versions", () => {
    const events = [login(0, 10), logout(30, 11)];
    const r = [...sessionRecaps(events, "classic1x", T0 + 3600_000).values()][0];
    expect(r.xp).toBeNull();
    expect(r.money).toBeNull();
  });
});

describe("xpBetween", () => {
  it("adds up whole levels in between", () => {
    expect(xpBetween("classic1x", { level: 1, xp: 0 }, { level: 1, xp: 300 })).toBe(300);
    expect(xpBetween("classic1x", { level: 1, xp: 0 }, { level: 3, xp: 0 })).toBe(400 + 900);
  });
});

describe("recapLine", () => {
  it("reads like a short summary", () => {
    const line = recapLine(
      {
        start: "",
        end: "",
        duration: 72 * 60,
        levelFrom: 21,
        levelTo: 22,
        xp: 9000,
        money: 11_000,
        quests: 3,
        loot: [],
        deaths: 0,
        closeCalls: 2,
        lowest: 9,
        dungeons: [],
        skillUps: 0,
        reputations: 0,
      },
      "en",
    );
    expect(line).toBe("1 h 12 · Level 21 → 22 · 3 quests · +1g 10s · ⚠️ 2 close calls (9%)");
  });
});

describe("dangerStats", () => {
  it("ranks what nearly killed you, deaths first", () => {
    const s = dangerStats([
      { type: "closeCall", pct: 20, level: 20, attacker: "Murloc", spell: null, zone: "Westfall", subZone: null, instance: null },
      { type: "closeCall", pct: 5, level: 20, attacker: "Murloc", spell: null, zone: "Westfall", subZone: null, instance: null },
      { type: "death", level: 22, killer: "Defias Pillager", zone: "Westfall", instance: "The Deadmines" },
      { type: "dungeon", action: "leave", name: "The Deadmines", kind: "party", group: [], deaths: 1, closeCalls: 0 },
      { type: "pet", action: "death", name: "Wolf", family: null, level: 20 },
    ]);
    expect(s).toMatchObject({ closeCalls: 2, deaths: 1, petDeaths: 1, lowest: 5 });
    expect(s.attackers.map((a) => a.name)).toEqual(["Defias Pillager", "Murloc"]);
    expect(s.attackers[1]).toMatchObject({ closeCalls: 2, lowest: 5 });
    expect(s.zones.map((z) => z.name)).toEqual(["The Deadmines", "Westfall"]);
    expect(s.dungeons).toEqual([{ name: "The Deadmines", runs: 1, closeCalls: 0, deaths: 1 }]);
  });
});

describe("todayInfo", () => {
  it("keeps live letters, the next to expire first, and counts bag slots", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const info = todayInfo(
      {
        syncedAt: "",
        updatedAt: "2026-10-03T11:00:00Z",
        xp: 1,
        xpMax: 2,
        rested: 3,
        resting: true,
        money: 100,
        playedTotal: 60,
        playedLevel: 1,
        zone: "Darkshore",
        subZone: null,
        x: null,
        y: null,
        hardcore: true,
        levelPlayed: {},
        questsCompleted: 0,
        skills: [],
        reputations: [],
        mail: {
          readAt: null,
          hasNew: false,
          letters: [
            { sender: "A", subject: null, money: 0, items: [], expiresAt: "2026-10-01T00:00:00Z", onExpiry: "deleted" },
            { sender: "B", subject: null, money: 0, items: [], expiresAt: "2026-10-09T00:00:00Z", onExpiry: "deleted" },
            { sender: "C", subject: null, money: 0, items: [], expiresAt: "2026-10-05T00:00:00Z", onExpiry: "returned" },
          ],
        },
        cooldowns: [],
        run: null,
        bags: [
          { bag: 0, name: null, size: 16, items: [{ slot: 1, itemId: 1, name: "x", count: 1, quality: 1 }] },
          { bag: 1, name: "Bag", size: 6, items: [] },
        ],
        bank: null,
        mapId: null,
        pet: null,
        stable: null,
      },
      now,
    );
    expect(info?.mail).toEqual({ letters: 2, hasNew: false, nextExpiry: "2026-10-05T00:00:00Z", nextOnExpiry: "returned" });
    expect(info?.bags).toEqual({ used: 1, total: 22 });
    expect(todayInfo(null)).toBeNull();
  });
});

describe("link previews", () => {
  const row = {
    id: 7,
    region: "eu",
    flavour: "classic1x",
    realmSlug: "soulseeker",
    realmName: "Soulseeker",
    realmCategory: "Classic Era",
    nameKey: "sealinedion",
    name: "Sealinedion",
    blizzardId: 1,
    level: 23,
    experience: 0,
    race: "Human",
    className: "Paladin",
    classKey: "paladin",
    gender: "",
    faction: "alliance",
    guild: null,
    isGhost: false,
    isSelfFound: true,
    itemLevel: null,
    avatarUrl: null,
    renderUrl: "https://render.worldofwarcraft.com/x.png",
    equipment: [],
    talents: [],
    stats: null,
    lastLoginAt: null,
    deadAt: null,
    status: "ok",
    missingReportedAt: null,
    fetchedAt: null,
    addon: null,
    ownerId: null,
    shared: false,
    snapshotVersion: 3,
    requestedAt: new Date(),
    createdAt: new Date(),
  } as const;

  it("describes the character, and how it fell", () => {
    const c = toSummary({ ...row, equipment: [], talents: [] });
    expect(ogDescription({ c, hardcore: true, playedTotal: 39331, death: null })).toBe(
      "Soulseeker (EU) · Hardcore · Self-Found · 10h 55m played",
    );
    const dead = { ...c, isGhost: true };
    expect(ogDescription({ c: dead, hardcore: true, playedTotal: null, death: { type: "death", level: 23, killer: "Bhag'thera", zone: "Stranglethorn Vale" } })).toBe(
      "💀 Fell at level 23 to Bhag'thera in Stranglethorn Vale · Soulseeker (EU) · Hardcore · Self-Found",
    );
  });

  it("escapes what goes into the page", () => {
    const c = toSummary({ ...row, equipment: [], talents: [], guild: `"><script>` });
    const html = ogPage({ c, hardcore: false, playedTotal: null, death: null }, "https://wow-locker.app");
    expect(html).not.toContain("<script>");
    expect(html).toContain('property="og:image" content="https://render.worldofwarcraft.com/x.png?v=0"');
    expect(html).toContain('content="#f48cba"');
  });
});
