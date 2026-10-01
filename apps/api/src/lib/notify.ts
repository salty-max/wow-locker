import type { EventData, Lang } from "@wow-locker/shared";

/**
 * Notification copy, rendered per recipient language (en/fr) at delivery time.
 * Character, item and guild names are the game's own and never translated.
 */
export const DEFAULT_LANG: Lang = "en";
export const asLang = (v: unknown): Lang | null => (v === "en" || v === "fr" ? v : null);

export type Rendered = { title: string; body: string };

export function renderEvent(character: string, e: EventData, lang: Lang): Rendered {
  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);
  switch (e.type) {
    case "level":
      return { title: character, body: t(`⬆️ Level ${e.to}!`, `⬆️ Niveau ${e.to} !`) };
    case "death":
      return {
        title: `💀 ${character}`,
        body: t(`Fell at level ${e.level}. Rest in peace.`, `Tombé·e au niveau ${e.level}. Repose en paix.`),
      };
    case "gear": {
      const shown = e.changes.filter((c) => c.to).slice(0, 3).map((c) => c.to);
      const more = e.changes.length - shown.length;
      return {
        title: character,
        body: `🛡️ ${shown.join(", ") || t("Gear changed", "Équipement modifié")}${more > 0 ? ` +${more}` : ""}`,
      };
    }
    case "respec":
      return {
        title: character,
        body: `🔀 ${t("New talents", "Nouveaux talents")}: ${e.to.map((x) => x.points).join("/")}`,
      };
    case "guild":
      return {
        title: character,
        body: e.to ? t(`🏰 Joined <${e.to}>`, `🏰 A rejoint <${e.to}>`) : t(`🏰 Left <${e.from}>`, `🏰 A quitté <${e.from}>`),
      };
    case "selfFoundLost":
      return { title: character, body: t("Self-Found mode lost", "Mode Self-Found perdu") };
    case "missing":
      return {
        title: character,
        body: t(
          "❔ No longer found on Battle.net (deleted, renamed or transferred)",
          "❔ Introuvable sur Battle.net (supprimé, renommé ou transféré)",
        ),
      };
    case "found":
      return { title: character, body: t("✅ Found again on Battle.net", "✅ De nouveau trouvé sur Battle.net") };
    case "tracked":
      return { title: character, body: t("Now tracked", "Suivi activé") };
  }
}

export function renderWelcome(lang: Lang): Rendered {
  return lang === "fr"
    ? { title: "wow-locker", body: "Notifications activées ✓" }
    : { title: "wow-locker", body: "Notifications enabled ✓" };
}
