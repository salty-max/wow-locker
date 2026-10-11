import { describe, expect, test } from "bun:test";
import { ADDON_VERSION, COMPANION_VERSION, downloadIn, type Release } from "./downloads";

const url = (name: string) => `https://github.com/x/releases/download/v1/${name}`;
const release = (tag: string, ...names: string[]): Release => ({ tag, assets: names.map((name) => ({ name, url: url(name) })) });

describe("a download", () => {
  test("the addon: its file, its version from its name (the tags are the site's)", () => {
    expect(downloadIn("addon", release("v0.1.14", "WowLocker-addon-v0.3.11.zip", "release.json"))).toEqual({
      href: url("WowLocker-addon-v0.3.11.zip"),
      version: "0.3.11",
    });
  });
  test("an older release's fixed name: its file, the version known here", () => {
    expect(downloadIn("addon", release("v0.1.13", "WowLocker-addon.zip"))).toEqual({
      href: url("WowLocker-addon.zip"),
      version: ADDON_VERSION,
    });
    expect(downloadIn("macos", release("v0.2.4", "ravenpost-macos.zip"))).toEqual({
      href: url("ravenpost-macos.zip"),
      version: "0.2.4",
    });
  });
  test("Ravenpost's, each platform its own", () => {
    const r = release("v0.2.5", "ravenpost-v0.2.5-macos.zip", "ravenpost-v0.2.5-windows-x64.exe", "ravenpost-v0.2.5-windows-arm64.exe");
    expect(downloadIn("windows", r).href).toBe(url("ravenpost-v0.2.5-windows-x64.exe"));
    expect(downloadIn("windowsArm", r)).toEqual({ href: url("ravenpost-v0.2.5-windows-arm64.exe"), version: "0.2.5" });
  });
  test("until GitHub answers: the release page, the versions known here", () => {
    expect(downloadIn("addon", undefined)).toEqual({
      href: "https://github.com/salty-max/wow-locker/releases/latest",
      version: ADDON_VERSION,
    });
    expect(downloadIn("macos", undefined).version).toBe(COMPANION_VERSION);
  });
});
