import type { Lang } from "@wow-locker/shared";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 h ago" / "il y a 3 h"; "now" under a minute. */
export function timeAgo(iso: string, lang: Lang, now = Date.now()): string {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  for (const [unit, s] of UNITS) {
    if (Math.abs(secs) >= s) return rtf.format(Math.round(secs / s), unit);
  }
  return rtf.format(0, "minute");
}

export function fullDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
