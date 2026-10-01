import { describe, expect, it } from "bun:test";
import type { EquippedItem } from "@wow-locker/shared";
import { availabilityStep, diffSnapshots, type Snapshot } from "./diff";

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
