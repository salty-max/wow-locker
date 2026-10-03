import type { CharacterSummary, ClassKey, EventData } from "@wow-locker/shared";

/**
 * Link previews (Discord, Slack, Messenger…): crawlers asking for a character
 * page get this tiny page with OpenGraph tags instead of the app, which they
 * can't run. Vercel routes them here by user agent (scripts/vercel-build.sh);
 * a person landing here by chance is sent on to the app.
 */

// The game's class colours (RAID_CLASS_COLORS): Discord draws the embed's
// side bar in the theme colour.
const CLASS_COLOR: Partial<Record<ClassKey, string>> = {
  warrior: "#c69b6d",
  paladin: "#f48cba",
  hunter: "#aad372",
  rogue: "#fff468",
  priest: "#ffffff",
  shaman: "#0070dd",
  mage: "#3fc7eb",
  warlock: "#8788ee",
  druid: "#ff7c0a",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export type OgInput = {
  c: CharacterSummary;
  hardcore: boolean;
  playedTotal: number | null;
  death: Extract<EventData, { type: "death" }> | null;
};

/** /played the way the game reads it: "4d 3h", "10h 55m". */
function played(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Previews are read by everyone in a channel: in English, like the game's names. */
export function ogDescription({ c, hardcore, playedTotal, death }: OgInput): string {
  const parts: string[] = [];
  if (c.isGhost) {
    const by = death?.killer ? ` to ${death.killer}` : "";
    const where = death?.instance ?? death?.zone;
    parts.push(`💀 Fell at level ${death?.level ?? c.level}${by}${where ? ` in ${where}` : ""}`);
  }
  parts.push(`${c.realmName} (${c.region.toUpperCase()})${hardcore ? " · Hardcore" : ""}${c.isSelfFound ? " · Self-Found" : ""}`);
  if (c.guild) parts.push(`<${c.guild}>`);
  if (playedTotal) parts.push(`${played(playedTotal)} played`);
  if (c.itemLevel) parts.push(`ilvl ${c.itemLevel}`);
  return parts.join(" · ");
}

export function ogPage(input: OgInput, origin: string): string {
  const { c } = input;
  const url = `${origin}/character/${c.id}`;
  const title = `${c.name} · Level ${c.level} ${c.race} ${c.className}`;
  const description = ogDescription(input);
  const image = c.renderUrl ?? c.avatarUrl;
  const color = c.isGhost ? "#7f7f7f" : ((c.classKey && CLASS_COLOR[c.classKey]) ?? "#ffd100");
  const meta = [
    ["og:site_name", "WoWLocker"],
    ["og:type", "profile"],
    ["og:url", url],
    ["og:title", title],
    ["og:description", description],
    ...(image ? [["og:image", image]] : []),
  ]
    .map(([p, v]) => `<meta property="${p}" content="${esc(v)}">`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)} · WoWLocker</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${color}">
${meta}
<meta name="twitter:card" content="${c.renderUrl ? "summary_large_image" : "summary"}">
<link rel="canonical" href="${esc(url)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head>
<body><a href="${esc(url)}">${esc(title)}</a></body>
</html>`;
}
