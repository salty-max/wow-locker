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
    case "death": {
      const by = e.killer ? t(` to ${e.killer}`, ` face à ${e.killer}`) : "";
      const where = e.instance ?? e.zone;
      return {
        title: `💀 ${character}`,
        body: t(
          `Fell at level ${e.level}${by}${where ? ` in ${where}` : ""}. Rest in peace.`,
          `Tombé·e au niveau ${e.level}${by}${where ? ` (${where})` : ""}. Repose en paix.`,
        ),
      };
    }
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
    case "session":
      return { title: character, body: e.action === "login" ? t("Logged in", "Connecté·e") : t("Logged out", "Déconnecté·e") };
    case "talent":
      return { title: character, body: `✨ ${t("Talents", "Talents")}: ${e.trees.map((x) => x.points).join("/")}` };
    case "quest":
      return {
        title: character,
        body:
          e.action === "accept"
            ? `📜 ${t("Quest accepted", "Quête acceptée")}: ${e.title ?? `#${e.questId}`}`
            : `📜 ${t("Quest completed", "Quête terminée")}: ${e.title ?? `#${e.questId}`}`,
      };
    case "closeCall": {
      const by = e.attacker ? t(` vs ${e.attacker}`, ` face à ${e.attacker}`) : "";
      const where = e.instance ?? e.zone;
      return {
        title: `⚠️ ${character}`,
        body: t(`Close call: ${e.pct}% health${by}${where ? ` (${where})` : ""}`, `Frôlé la mort : ${e.pct} % de vie${by}${where ? ` (${where})` : ""}`),
      };
    }
    case "dungeon": {
      if (e.action === "enter") return { title: character, body: `🏰 ${t("Entered", "Entre dans")} ${e.name}` };
      const mins = Math.round((e.duration ?? 0) / 60);
      const dur = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
      const deaths = e.deaths ? t(`, ${e.deaths} death${e.deaths > 1 ? "s" : ""}`, `, ${e.deaths} mort${e.deaths > 1 ? "s" : ""}`) : "";
      return { title: character, body: `🏰 ${e.name}: ${dur}${deaths}` };
    }
    case "loot":
      return { title: character, body: `🎁 ${e.name}${e.count > 1 ? ` ×${e.count}` : ""}` };
    case "skill":
      return {
        title: character,
        body: e.learned ? `📘 ${t("Learned", "Appris")}: ${e.name}` : `📘 ${e.name} ${e.rank}/${e.max}`,
      };
    case "reputation":
      return { title: character, body: `🤝 ${e.label ?? e.standing} ${t("with", "avec")} ${e.faction}` };
    case "reminder":
      switch (e.kind) {
        case "mailExpiring":
          return {
            title: `📬 ${character}`,
            body: t(
              `Mail expiring within 24 h: ${e.detail ?? "a letter"}${e.count ? ` (${e.count} item${e.count > 1 ? "s" : ""})` : ""}${e.onExpiry === "returned" ? ", returned to sender" : ", then deleted"}`,
              `Courrier expirant sous 24 h : ${e.detail ?? "une lettre"}${e.count ? ` (${e.count} objet${e.count > 1 ? "s" : ""})` : ""}${e.onExpiry === "returned" ? ", renvoyé à l'expéditeur" : ", puis supprimé"}`,
            ),
          };
        case "rested":
          return { title: `💤 ${character}`, body: t("Fully rested", "Entièrement reposé·e") };
        case "cooldown":
          return { title: `⏳ ${character}`, body: t(`${e.detail ?? "Cooldown"} is ready`, `${e.detail ?? "Recharge"} est prêt`) };
      }
  }
}

export function renderWelcome(lang: Lang): Rendered {
  return lang === "fr"
    ? { title: "WoWLocker", body: "Notifications activées ✓" }
    : { title: "WoWLocker", body: "Notifications enabled ✓" };
}
