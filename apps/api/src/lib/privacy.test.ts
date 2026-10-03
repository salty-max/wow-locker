import { describe, expect, it } from "bun:test";
import type { CharacterEvent } from "@wow-locker/shared";
import { canSeePrivate, isMine, publicEvents } from "@/lib/privacy";

describe("privacy", () => {
  const owned = { ownerId: 7, shared: false };
  it("keeps an owned character's details for its owner, unless shared", () => {
    expect(canSeePrivate(owned, { accountId: 7 })).toBe(true);
    expect(canSeePrivate(owned, { accountId: 8 })).toBe(false);
    expect(canSeePrivate(owned, null)).toBe(false);
    expect(canSeePrivate({ ...owned, shared: true }, null)).toBe(true);
    expect(isMine(owned, { accountId: 7 })).toBe(true);
  });
  it("leaves unclaimed characters public, as before accounts", () => {
    expect(canSeePrivate({ ownerId: null, shared: false }, null)).toBe(true);
  });
  it("drops reminders and gold from what others see of the timeline", () => {
    const ev = (id: number, data: CharacterEvent["data"]): CharacterEvent => ({ id, characterId: 1, at: "", source: "addon", data });
    const out = publicEvents([
      ev(1, { type: "reminder", kind: "mailExpiring", detail: "Sale Pending", count: 1 }),
      ev(2, {
        type: "session",
        action: "logout",
        level: 20,
        recap: { start: "", end: "", duration: 60, levelFrom: 20, levelTo: 20, xp: 10, money: 5000, quests: 0, loot: [], deaths: 0, closeCalls: 0, lowest: null, dungeons: [], skillUps: 0, reputations: 0 },
      }),
      ev(3, { type: "level", from: 19, to: 20 }),
    ]);
    expect(out.map((e) => e.id)).toEqual([2, 3]);
    expect(out[0].data.type === "session" && out[0].data.recap?.money).toBeNull();
  });
});
