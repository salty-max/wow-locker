import { describe, expect, it } from "bun:test";
import { dropIndex, moveTo } from "@/lib/roster";

describe("reordering the locker", () => {
  it("moves a character to a position", () => {
    expect(moveTo([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4]);
    expect(moveTo([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3]);
    expect(moveTo([1, 2, 3], 2, 99)).toEqual([1, 3, 2]);
    expect(moveTo([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
  });
  it("drops a row after the rows whose middle is above the pointer", () => {
    const middles = [20, 60, 100]; // the other rows
    expect(dropIndex(middles, 5)).toBe(0);
    expect(dropIndex(middles, 70)).toBe(2);
    expect(dropIndex(middles, 200)).toBe(3);
  });
});
