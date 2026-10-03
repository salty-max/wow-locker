import { describe, expect, it } from "bun:test";
import type { EventData } from "@wow-locker/shared";
import { isNoise, NOISE_AFTER_MS, withinRetention } from "@/lib/retention";

describe("retention", () => {
  it("calls logins, /reload logouts, accepted quests, skill-ups and reminders noise", () => {
    const noise: EventData[] = [
      { type: "session", action: "login", level: 10 },
      { type: "session", action: "logout", level: 10 },
      { type: "quest", action: "accept", questId: 1, title: null, xp: 0, money: 0 },
      { type: "skill", name: "Mining", section: null, rank: 75, max: 150, learned: false },
      { type: "reminder", kind: "rested", detail: null },
    ];
    const kept: EventData[] = [
      { type: "quest", action: "complete", questId: 1, title: null, xp: 10, money: 0 },
      { type: "skill", name: "Mining", section: null, rank: 1, max: 75, learned: true },
      { type: "level", from: 9, to: 10 },
      { type: "death", level: 10 },
      {
        type: "session",
        action: "logout",
        level: 10,
        recap: { start: "", end: "", duration: 60, levelFrom: 9, levelTo: 10, xp: null, money: null, quests: 0, loot: [], deaths: 0, closeCalls: 0, lowest: null, dungeons: [], skillUps: 0, reputations: 0 },
      },
    ];
    expect(noise.every(isNoise)).toBe(true);
    expect(kept.some(isNoise)).toBe(false);
  });

  it("skips only old noise at upload (pruned rows would otherwise come back)", () => {
    const now = Date.parse("2026-10-03T00:00:00Z");
    const old = new Date(now - NOISE_AFTER_MS - 1000);
    const recent = new Date(now - 1000);
    const events = [
      { at: old, data: { type: "session", action: "login", level: 1 } as EventData },
      { at: old, data: { type: "level", from: 1, to: 2 } as EventData },
      { at: recent, data: { type: "session", action: "login", level: 2 } as EventData },
    ];
    expect(withinRetention(events, now).map((e) => e.data.type)).toEqual(["level", "session"]);
  });
});
