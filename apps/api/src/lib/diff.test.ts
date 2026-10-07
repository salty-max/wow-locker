import { describe, expect, it } from "bun:test";
import type { EquippedItem } from "@wow-locker/shared";
import { availabilityStep, diffSnapshots, isGone, superseded, type Snapshot } from "./diff";

const item = (slot: string, itemId: number, name: string): EquippedItem => ({
  slot,
  slotName: slot,
  itemId,
  name,
  quality: "uncommon",
  iconUrl: null,
  enchantments: [],
});
const base: Snapshot = {
  level: 17,
  isGhost: false,
  isSelfFound: true,
  guild: null,
  equipment: [item("MAIN_HAND", 4564, "Spiked Club of the Boar"), item("SHIRT", 1, "Red Linen Shirt")],
  talents: [{ active: true, trees: [{ name: "Holy", points: 7 }] }],
};

describe("diffSnapshots", () => {
  it("is quiet when nothing changed", () => {
    expect(diffSnapshots(base, { ...base })).toEqual([]);
  });

  it("reports level-ups without treating new talent points as a respec", () => {
    const next = { ...base, level: 19, talents: [{ active: true, trees: [{ name: "Holy", points: 9 }] }] };
    expect(diffSnapshots(base, next)).toEqual([{ type: "level", from: 17, to: 19 }]);
  });

  it("reports a respec when points leave a tree", () => {
    const next = { ...base, talents: [{ active: true, trees: [{ name: "Holy", points: 0 }, { name: "Retribution", points: 7 }] }] };
    expect(diffSnapshots(base, next)[0]).toMatchObject({ type: "respec" });
  });

  it("batches gear changes and ignores cosmetic slots", () => {
    const next = {
      ...base,
      equipment: [item("MAIN_HAND", 2, "Ironforge Mace"), item("SHIRT", 3, "Blue Shirt"), item("HEAD", 5, "Helm")],
    };
    const [gear] = diffSnapshots(base, next);
    expect(gear).toMatchObject({ type: "gear" });
    expect(gear.type === "gear" && gear.changes.map((c) => `${c.slot}:${c.from}→${c.to}`).sort()).toEqual([
      "HEAD:null→Helm",
      "MAIN_HAND:Spiked Club of the Boar→Ironforge Mace",
    ]);
  });

  it("death wins over everything else", () => {
    expect(diffSnapshots(base, { ...base, isGhost: true, level: 18, guild: "X" })).toEqual([{ type: "death", level: 18 }]);
  });

  it("notices guild changes and losing Self-Found", () => {
    expect(diffSnapshots(base, { ...base, guild: "Hardcore Heroes", isSelfFound: false })).toEqual([
      { type: "guild", from: null, to: "Hardcore Heroes" },
      { type: "selfFoundLost" },
    ]);
  });
});

describe("availabilityStep", () => {
  const ok = { status: "ok" as const, missingReported: false };

  it("waits for a second 404 before reporting a character missing", () => {
    const first = availabilityStep(ok, "not_found");
    expect(first.event).toBeNull();
    const second = availabilityStep(first.next, "not_found");
    expect(second.event).toEqual({ type: "missing" });
    expect(availabilityStep(second.next, "not_found").event).toBeNull(); // reported once
  });

  it("forgives a single spurious 404", () => {
    const blip = availabilityStep(ok, "not_found");
    expect(availabilityStep(blip.next, "ok")).toEqual({ next: ok, event: null });
  });

  it("reports a missing character coming back", () => {
    expect(availabilityStep({ status: "not_found", missingReported: true }, "ok").event).toEqual({ type: "found" });
  });

  it("ignores errors", () => {
    expect(availabilityStep(ok, "error")).toEqual({ next: ok, event: null });
  });
});

describe("isGone", () => {
  const paired = { at: new Date("2026-10-02T20:00:00Z"), ids: [1, 2], unavailable: [] as string[] };
  const login = { at: new Date("2026-10-07T18:00:00Z"), ids: [1, 2, 3], unavailable: [] as string[] };
  it("left out of the pairing's list, last seen before it: deleted", () => {
    expect(isGone([paired], 9, false, "2026-09-01T10:00:00.000Z", false)).toBe(true);
  });
  it("seen after every list (new, or played again): only not linked", () => {
    expect(isGone([paired, login], 9, false, "2026-10-07T19:00:00.000Z", false)).toBe(false);
  });
  it("created after pairing, deleted before the last login: the login's list tells", () => {
    expect(isGone([paired, login], 9, false, "2026-10-05T10:00:00.000Z", false)).toBe(true);
  });
  it("on the freshest list: there", () => {
    expect(isGone([paired, login], 3, false, "2026-10-05T10:00:00.000Z", false)).toBe(false);
  });
  it("a fresh list missing a flavour can't tell: the one before it does", () => {
    const partial = { ...login, unavailable: ["classic1x"] };
    expect(isGone([paired, partial], 9, false, "2026-10-05T10:00:00.000Z", false)).toBe(false);
    expect(isGone([paired, partial], 9, false, "2026-09-01T10:00:00.000Z", false)).toBe(true);
  });
  it("a link from before the flavours were kept: its list taken as complete", () => {
    expect(isGone([{ ...paired, unavailable: null }], 9, false, "2026-09-01T10:00:00.000Z", false)).toBe(true);
  });
  it("never seen by the addon: can't tell", () => {
    expect(isGone([paired], 9, false, null, false)).toBe(false);
  });
  it("a tracked character: gone only once Battle.net reported it missing", () => {
    expect(isGone([paired], 1, true, "2026-09-01T10:00:00.000Z", false)).toBe(false);
    expect(isGone([paired], 1, true, "2026-09-01T10:00:00.000Z", true)).toBe(true);
  });
});

describe("superseded", () => {
  it("a name played again on the same realm: the older ones are gone", () => {
    const chars = [
      { guid: "a", realmId: 5, name: "Testlore", lastSeen: "2026-10-03T10:00:00.000Z" },
      { guid: "b", realmId: 5, name: "Testlore", lastSeen: "2026-10-06T10:00:00.000Z" },
      { guid: "c", realmId: 5, name: "testlore", lastSeen: "2026-10-04T10:00:00.000Z" },
      { guid: "d", realmId: 6, name: "Testlore", lastSeen: "2026-10-01T10:00:00.000Z" },
      { guid: "e", realmId: 5, name: "Namzie", lastSeen: null },
    ];
    expect([...superseded(chars)].sort()).toEqual(["a", "c"]);
  });
});
