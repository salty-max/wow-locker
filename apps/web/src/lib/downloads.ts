/**
 * The addon + companion downloads: assets of the repo's latest GitHub release
 * (`releases/latest/download/<file>` always points at the newest one). Built by
 * `companion/scripts/build.sh`; bump the versions here when publishing.
 */
export const RELEASES_URL = "https://github.com/salty-max/wow-locker/releases";
export const ADDON_VERSION = "0.3.7";
export const COMPANION_VERSION = "0.1.3";

export const download = (file: string) => `${RELEASES_URL}/latest/download/${file}`;

export const FILES = {
  addon: "WowLocker-addon.zip",
  macos: "wow-locker-companion-macos.zip",
  windows: "wow-locker-companion-windows-x64.exe",
  windowsArm: "wow-locker-companion-windows-arm64.exe",
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
