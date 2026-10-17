import { useQuery } from "@tanstack/react-query";

/**
 * The downloads: the addon from this repo's latest GitHub release, Ravenpost
 * (the companion app, its own repo since 0.2.0, shared with Hearthtale) from
 * salty-max/ravenpost's. Their files carry their version in their name
 * (WowLocker-addon-v0.3.11.zip, ravenpost-v0.2.5-macos.zip; older releases'
 * none), so the newest release is asked of GitHub's API (the visitor's own
 * quota, no key: security-headers.json lets it through) and each button links
 * its file, its version shown; until GitHub answers, or if it doesn't, the
 * release page and the versions below.
 */
export const ADDON_REPO = "salty-max/wow-locker";
export const RAVENPOST_REPO = "salty-max/ravenpost";
export const RELEASES_URL = `https://github.com/${ADDON_REPO}/releases`;
export const RAVENPOST_RELEASES_URL = `https://github.com/${RAVENPOST_REPO}/releases`;
/** The versions shown until GitHub answers. */
export const ADDON_VERSION = "0.3.11";
export const COMPANION_VERSION = "0.2.5";

/** Each download: its repo, its file's name (with its version or without). */
export const FILES = {
  addon: { repo: ADDON_REPO, name: /^WowLocker-addon(?:-v([\d.]+))?\.zip$/, version: ADDON_VERSION },
  macos: { repo: RAVENPOST_REPO, name: /^ravenpost(?:-v([\d.]+))?-macos\.zip$/, version: COMPANION_VERSION },
  windows: { repo: RAVENPOST_REPO, name: /^ravenpost(?:-v([\d.]+))?-windows-x64\.exe$/, version: COMPANION_VERSION },
  windowsArm: { repo: RAVENPOST_REPO, name: /^ravenpost(?:-v([\d.]+))?-windows-arm64\.exe$/, version: COMPANION_VERSION },
} as const;
export type Download = keyof typeof FILES;

export interface Release {
  tag: string;
  assets: { name: string; url: string }[];
}

/** A repo's newest release, by GitHub's API. */
export async function latestRelease(repo: string): Promise<Release> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub: ${res.status}`);
  const body = (await res.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  return { tag: body.tag_name, assets: body.assets.map((a) => ({ name: a.name, url: a.browser_download_url })) };
}

/**
 * A download in a release: its file's link, else the release page; its
 * version, from the file's name, else Ravenpost's tag (the addon's tags are
 * the site's), else the one above.
 */
export function downloadIn(which: Download, release: Release | undefined): { href: string; version: string } {
  const file = FILES[which];
  for (const a of release?.assets ?? []) {
    const m = file.name.exec(a.name);
    if (m) {
      const fromTag = file.repo === RAVENPOST_REPO ? release?.tag.replace(/^v/, "") : undefined;
      return { href: a.url, version: m[1] ?? fromTag ?? file.version };
    }
  }
  return { href: `https://github.com/${file.repo}/releases/latest`, version: file.version };
}

/** A download's link and version (GitHub's answer, once it comes). */
export function useDownload(which: Download): { href: string; version: string } {
  const repo = FILES[which].repo;
  const { data } = useQuery({
    queryKey: ["latest-release", repo],
    queryFn: () => latestRelease(repo),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  return downloadIn(which, data);
}

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
