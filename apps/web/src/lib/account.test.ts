import { describe, expect, it } from "bun:test";
import { mergeRosters } from "@/lib/account";

describe("mergeRosters", () => {
  it("keeps the account's order, then this device's extra characters", () => {
    expect(mergeRosters([3, 1], [1, 2, 5])).toEqual([3, 1, 2, 5]);
    expect(mergeRosters([], [4])).toEqual([4]);
    expect(mergeRosters([1, 2, 3], [4, 5], 4)).toEqual([1, 2, 3, 4]);
  });
});
