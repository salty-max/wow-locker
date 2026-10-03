import { describe, expect, it } from "bun:test";
import { versionedRender } from "@/lib/tracker";

describe("versionedRender", () => {
  const url = "https://render.worldofwarcraft.com/classic1x-eu/character/soulseeker/53/88269365-main-raw.png";
  const login = new Date("2026-10-03T17:12:32Z");
  const h = 3600_000;

  it("changes with each login, so a new login refetches the render", () => {
    const later = new Date(login.getTime() + 86400_000);
    expect(versionedRender(url, login, login.getTime() + 30 * 86400_000)).not.toBe(
      versionedRender(url, later, later.getTime() + 30 * 86400_000),
    );
  });

  it("rechecks every 6 hours while Blizzard may still be redrawing (3 days)", () => {
    const a = versionedRender(url, login, login.getTime() + 1 * h);
    const b = versionedRender(url, login, login.getTime() + 8 * h);
    expect(a).not.toBe(b);
    expect(a).toMatch(/\?v=\d+-\d+$/);
  });

  it("settles once the character hasn't logged in for days", () => {
    const a = versionedRender(url, login, login.getTime() + 10 * 86400_000);
    const b = versionedRender(url, login, login.getTime() + 20 * 86400_000);
    expect(a).toBe(b);
    expect(a).toBe(`${url}?v=${Math.floor(login.getTime() / 1000)}`);
  });

  it("leaves a missing render missing", () => {
    expect(versionedRender(null, login)).toBeNull();
  });
});
