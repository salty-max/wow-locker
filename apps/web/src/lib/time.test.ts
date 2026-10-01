import { describe, expect, it } from "bun:test";
import { timeAgo } from "./time";

describe("timeAgo", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  it("formats relative times per language", () => {
    expect(timeAgo("2026-10-01T09:00:00Z", "en", now)).toBe("3 hr. ago");
    expect(timeAgo("2026-09-29T12:00:00Z", "fr", now)).toBe("avant-hier");
    expect(timeAgo("2026-10-01T11:59:40Z", "en", now)).toBe("this minute");
  });
});
