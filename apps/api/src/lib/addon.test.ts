import { describe, expect, it } from "bun:test";
import session from "./__fixtures__/addon-session.json";
import { computeReminders, mapEvent, parseAddonCharacter, parseGuid, restedFullAt } from "./addon";

// The fixture is the addon's own output (luajit addon/test/sim.lua with WL_DUMP):
// a simulated Hardcore session on Soulseeker.
const [[guid, raw]] = Object.entries(session.characters);

describe("parseGuid", () => {
  it("decodes the Battle.net realm and character ids (verified on a real character)", () => {
    expect(parseGuid("Player-6113-03D658B8")).toEqual({ realmId: 6113, characterId: 64379064 });
    expect(parseGuid("Creature-0-123")).toBeNull();
    expect(parseGuid("Player-6113-XYZ")).toBeNull();
  });
});

describe("parseAddonCharacter", () => {
  const c = parseAddonCharacter(guid, raw)!;

  it("identifies the character", () => {
    expect(c).toMatchObject({ name: "Namzie", realm: "Soulseeker", realmId: 6113, characterId: 64379064 });
  });

  it("maps every recorded event", () => {
    const types = c.events.map((e) => e.data.type);
    expect(types).toEqual([
      "session",
      "gear",
      "gear",
      "loot",
      "closeCall",
      "closeCall",
      "quest",
      "quest",
      "level",
      "skill",
      "skill",
      "reputation",
      "dungeon",
      "closeCall",
      "death",
      "dungeon",
      "session",
    ]);
    expect(c.events.find((e) => e.data.type === "death")!.data).toMatchObject({
      killer: "Edwin VanCleef",
      spell: "Thrash",
      instance: "The Deadmines",
    });
    expect(c.events.find((e) => e.data.type === "level")!.data).toEqual({ type: "level", from: 22, to: 23, played: 90000 });
    expect(c.events.find((e) => e.data.type === "loot")!.data).toMatchObject({ name: "Defias Mask", quality: "uncommon", count: 2 });
    const quests = c.events.filter((e) => e.data.type === "quest").map((e) => e.data);
    expect(quests).toMatchObject([
      { action: "accept", questId: 155, title: "The Defias Brotherhood", level: 18, xp: 0 },
      { action: "complete", questId: 155, title: "The Defias Brotherhood", xp: 1650, money: 3500 },
    ]);
  });

  it("gives every event a stable key, so re-uploads dedupe", () => {
    const again = parseAddonCharacter(guid, structuredClone(raw))!;
    expect(again.events.map((e) => e.key)).toEqual(c.events.map((e) => e.key));
    expect(new Set(c.events.map((e) => e.key)).size).toBe(c.events.length);
  });

  it("keeps an event's key when the addon edits it after a /reload", () => {
    const edited = structuredClone(raw) as { events: Record<string, unknown>[] };
    for (const e of edited.events) {
      if (e.type === "close_call") e.pct = 1; // the dip went deeper
      if (e.type === "level") delete e.played; // saved before /played answered
    }
    expect(parseAddonCharacter(guid, edited)!.events.map((e) => e.key)).toEqual(c.events.map((e) => e.key));
  });

  it("keeps identical events in the same second apart", () => {
    const loot = { type: "loot", t: 1_790_900_000, itemId: 2589, name: "Linen Cloth", color: "1eff00", count: 1, how: "loot" };
    const twice = parseAddonCharacter(guid, { name: "Namzie", events: [loot, { ...loot }], state: {} })!;
    expect(twice.events).toHaveLength(2);
    expect(new Set(twice.events.map((e) => e.key)).size).toBe(2);
  });

  it("keeps the state", () => {
    expect(c.state).toMatchObject({ xp: 1542, xpMax: 27300, rested: 4000, resting: true, money: 12345, questsCompleted: 3, hardcore: true });
    expect(c.state.levelPlayed).toEqual({ "23": 90000 });
    expect(c.state.mail?.letters).toHaveLength(2);
    expect(c.state.cooldowns[0]).toMatchObject({ name: "Mooncloth", spellId: 18560 });
  });

  it("keeps the bags and the bank visit", () => {
    expect(c.state.bags.map((b) => [b.name, b.size, b.items.length])).toEqual([
      ["Backpack", 16, 3],
      ["Linen Bag", 6, 1],
    ]);
    expect(c.state.bags[0].items[0]).toEqual({ slot: 1, itemId: 2589, name: "Linen Cloth", count: 20, quality: 1 });
    expect(c.state.bank?.containers.map((b) => b.name)).toEqual(["Bank", "Green Woolen Bag"]);
    expect(c.state.bank?.at).toMatch(/^2026-/);
  });

  it("keeps where a death and a close call happened, on which map", () => {
    const death = c.events.find((e) => e.data.type === "death")!.data;
    expect(death).toMatchObject({ mapId: 1436, x: 42.1, y: 74.6 });
    const call = c.events.find((e) => e.data.type === "closeCall")!.data;
    expect(call).toMatchObject({ mapId: 1436, x: 42.1, y: 74.6 });
    expect(c.state.mapId).toBe(1436);
  });

  it("reads the pet, the stable and pet events", () => {
    const t = 1_790_900_000;
    const p = parseAddonCharacter(guid, {
      name: "Namzie",
      events: [
        { type: "pet_new", t, name: "Wolfy", family: "Wolf", level: 23, hunter: true },
        { type: "pet_level", t: t + 60, name: "Wolfy", family: "Wolf", level: 24 },
        { type: "pet_death", t: t + 120, name: "Wolfy", family: "Wolf", level: 24, zone: "Westfall", mapId: 1436, x: 40, y: 50 },
        { type: "pet_new", t, family: "Wolf" }, // no name: dropped
      ],
      state: {
        pet: { name: "Wolfy", family: "Wolf", level: 24, active: false, hunter: true, icon: 132203, xp: 1200, xpMax: 4800, happiness: 3, loyalty: "Loyalty Level 3 (Faithful)", trainingPoints: 120, trainingSpent: 85, abilities: ["Bite (Rank 3)", 42] },
        stable: { at: t, pets: [{ slot: 1, name: "Fang", family: "Cat", level: 18, icon: 132185 }, { slot: 2 }] },
      },
    })!;
    expect(p.events.map((e) => e.data)).toEqual([
      { type: "pet", action: "new", name: "Wolfy", family: "Wolf", level: 23 },
      { type: "pet", action: "level", name: "Wolfy", family: "Wolf", level: 24 },
      { type: "pet", action: "death", name: "Wolfy", family: "Wolf", level: 24, zone: "Westfall", mapId: 1436, x: 40, y: 50 },
    ]);
    expect(p.state.pet).toMatchObject({ name: "Wolfy", active: false, hunter: true, icon: 132203, happiness: 3, abilities: ["Bite (Rank 3)"] });
    expect(p.state.stable?.pets).toEqual([{ slot: 1, name: "Fang", family: "Cat", level: 18, icon: 132185, loyalty: null }]);
  });

  it("bounds bag data", () => {
    const bad = parseAddonCharacter(guid, {
      name: "Namzie",
      events: [],
      state: {
        bags: [
          { bag: 0, size: 999, items: [] }, // impossible size: dropped
          { bag: 1, size: 4, items: [{ slot: 9, id: 1, name: "Out of range" }, { slot: 1, id: 2, name: "Ok", count: -5, q: 42 }] },
        ],
      },
    })!;
    expect(bad.state.bags).toEqual([{ bag: 1, name: null, size: 4, items: [{ slot: 1, itemId: 2, name: "Ok", count: 1, quality: null }] }]);
    expect(bad.state.bank).toBeNull();
  });

  it("rejects what it can't trust", () => {
    expect(parseAddonCharacter("not-a-guid", raw)).toBeNull();
    expect(parseAddonCharacter(guid, { events: "nope" })).toBeNull(); // no name
    expect(mapEvent({ type: "future_thing", t: 1 })).toBeNull();
    expect(mapEvent({ type: "quest", t: 1 })).toBeNull(); // no quest id
    const junk = parseAddonCharacter(guid, { name: "Namzie", events: [{ type: "level", level: 5, t: 42 }], state: { money: "lots" } })!;
    expect(junk.events).toHaveLength(0); // a 1970 clock
    expect(junk.state.money).toBeNull();
  });
});

describe("rested", () => {
  const base = { level: 23, flavour: "classic1x" as const, xpMax: 27300, loggedOutAt: new Date("2026-10-02T00:00:00Z") };

  it("fills 5% of a level per 8 h while resting, up to 150%", () => {
    // 0 → 150% = 30 × 5% = 240 h = 10 days.
    expect(restedFullAt({ ...base, rested: 0, resting: true })!.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("is four times slower outside an inn or city", () => {
    expect(restedFullAt({ ...base, rested: 0, resting: false })!.toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });

  it("does nothing at max level or when already full", () => {
    expect(restedFullAt({ ...base, level: 60, rested: 0, resting: true })).toBeNull();
    expect(restedFullAt({ ...base, rested: 40950, resting: true })).toBeNull();
  });
});

describe("computeReminders", () => {
  const c = parseAddonCharacter(guid, raw)!;
  const logout = new Date(c.state.updatedAt!);

  it("schedules mail, rested and cooldown reminders from the session", () => {
    const r = computeReminders({ state: c.state, level: 23, xpMax: 27300, flavour: "classic1x", loggedOut: true, now: logout });
    const of = (kind: string) => r.filter((x) => x.kind === kind);
    const byKind = { mailExpiring: of("mailExpiring"), rested: of("rested"), cooldown: of("cooldown") };
    expect(byKind.mailExpiring).toHaveLength(2);
    // Namzan's letter (2.5 days, items → returned): warned 24 h before.
    const letter = byKind.mailExpiring!.find((x) => x.data.type === "reminder" && x.data.onExpiry === "returned")!;
    const expires = new Date(c.state.mail!.letters[0].expiresAt).getTime();
    expect(letter.fireAt.getTime()).toBe(expires - 24 * 3600_000);
    expect(byKind.rested).toHaveLength(1);
    expect(byKind.cooldown![0].data).toMatchObject({ kind: "cooldown", detail: "Mooncloth" });
  });

  it("warns at once when a letter already expires within 24 h", () => {
    const later = new Date(new Date(c.state.mail!.letters[1].expiresAt).getTime() - 3600_000);
    const r = computeReminders({ state: c.state, level: 23, xpMax: 27300, flavour: "classic1x", loggedOut: true, now: later });
    expect(r.filter((x) => x.kind === "mailExpiring").every((x) => x.fireAt >= later)).toBe(true);
  });

  it("keys repeat reminders per cycle, so the next one isn't blocked by the last", () => {
    const r = computeReminders({ state: c.state, level: 23, xpMax: 27300, flavour: "classic1x", loggedOut: true, now: logout });
    const nextCycle = {
      ...c.state,
      updatedAt: new Date(logout.getTime() + 5 * 86400_000).toISOString(),
      cooldowns: c.state.cooldowns.map((cd) => ({ ...cd, readyAt: new Date(Date.parse(cd.readyAt) + 5 * 86400_000).toISOString() })),
    };
    const r2 = computeReminders({ state: nextCycle, level: 23, xpMax: 27300, flavour: "classic1x", loggedOut: true, now: logout });
    for (const kind of ["rested", "cooldown"] as const) {
      expect(r2.find((x) => x.kind === kind)!.key).not.toBe(r.find((x) => x.kind === kind)!.key);
    }
  });

  it("no rested reminder while still logged in", () => {
    const r = computeReminders({ state: c.state, level: 23, xpMax: 27300, flavour: "classic1x", loggedOut: false, now: logout });
    expect(r.some((x) => x.kind === "rested")).toBe(false);
  });
});
