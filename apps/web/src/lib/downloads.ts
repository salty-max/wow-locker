/**
 * The downloads: the addon from this repo's latest GitHub release, Ravenpost
 * (the companion app, its own repo since 0.2.0, shared with Hearthtale) from
 * salty-max/ravenpost's. `releases/latest/download/<file>` always points at the
 * newest one; bump the versions here when publishing.
 */
export const RELEASES_URL = "https://github.com/salty-max/wow-locker/releases";
export const RAVENPOST_RELEASES_URL = "https://github.com/salty-max/ravenpost/releases";
export const ADDON_VERSION = "0.3.8";
export const COMPANION_VERSION = "0.2.4";

/** A file of the latest release: the addon's here, Ravenpost's there. */
export const download = (file: string) =>
  `${file === FILES.addon ? RELEASES_URL : RAVENPOST_RELEASES_URL}/latest/download/${file}`;

export const FILES = {
  addon: "WowLocker-addon.zip",
  macos: "ravenpost-macos.zip",
  windows: "ravenpost-windows-x64.exe",
  windowsArm: "ravenpost-windows-arm64.exe",
} as const;

export type Platform = "macos" | "windows" | "other";

/** The visitor's desktop OS (phones: "other", the game runs on a computer). */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Android/i.test(ua)) return "other";
  if (/Mac/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  return "other";
}
