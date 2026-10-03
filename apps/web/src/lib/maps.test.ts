import { describe, expect, it } from "bun:test";
import { hasMap, mapFor } from "@/lib/maps";

describe("mapFor", () => {
  it("uses the map id when there's a map for it", () => {
    expect(mapFor(1436, "Westfall")).toBe(1436);
    expect(hasMap(1439)).toBe(true);
  });
  it("falls back to the zone name, case-insensitive", () => {
    expect(mapFor(null, "Darkshore")).toBe(1439);
    expect(mapFor(undefined, "darkshore")).toBe(1439);
  });
  it("has nothing for unknown places", () => {
    expect(mapFor(null, "The Deadmines")).toBeNull(); // no dungeon maps
    expect(mapFor(999999, null)).toBeNull();
  });
});
