import type { EventData, Lang, SessionRecap } from "@wow-locker/shared";

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
      if (e.recap) return { title: `🏁 ${character}`, body: recapLine(e.recap, lang) };
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
    case "pet":
      return e.action === "death"
        ? { title: `💀 ${character}`, body: t(`${e.name} (level ${e.level}) died`, `${e.name} (niveau ${e.level}) est mort`) }
        : e.action === "new"
          ? { title: character, body: t(`🐾 New pet: ${e.name}${e.family ? ` (${e.family})` : ""}`, `🐾 Nouveau familier : ${e.name}${e.family ? ` (${e.family})` : ""}`) }
          : { title: character, body: t(`🐾 ${e.name} reached level ${e.level}`, `🐾 ${e.name} atteint le niveau ${e.level}`) };
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

/** "1 h 12 min · Level 21 → 23 · 14 quests · +2g 40s · 1 close call (12%)" */
export function recapLine(r: SessionRecap, lang: Lang): string {
  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const n = (v: number) => v.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
  const plural = (v: number, en: string, fr: string) => `${n(v)} ${t(en, fr)}${v > 1 ? "s" : ""}`;
  const mins = Math.max(1, Math.round(r.duration / 60));
  const parts = [mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}` : `${mins} min`];
  if (r.levelTo > r.levelFrom) parts.push(t(`Level ${r.levelFrom} → ${r.levelTo}`, `Niveau ${r.levelFrom} → ${r.levelTo}`));
  else if (r.xp) parts.push(`+${n(r.xp)} XP`);
  if (r.quests) parts.push(plural(r.quests, "quest", "quête"));
  if (r.money) {
    const abs = Math.abs(r.money);
    const g = Math.floor(abs / 10000);
    const s = Math.floor(abs / 100) % 100;
    const coins = g ? `${g}g ${s}s` : s ? `${s}s ${abs % 100}c` : `${abs % 100}c`;
    parts.push(`${r.money > 0 ? "+" : "−"}${coins}`);
  }
  if (r.dungeons.length) parts.push(r.dungeons.join(", "));
  if (r.loot.length) parts.push(r.loot.map((l) => `[${l.name}]`).join(" "));
  if (r.deaths) parts.push(`💀 ${plural(r.deaths, "death", "mort")}`);
  else if (r.closeCalls) parts.push(`⚠️ ${plural(r.closeCalls, "close call", "frayeur")}${r.lowest != null ? ` (${r.lowest}%)` : ""}`);
  return parts.join(" · ");
}

export function renderWelcome(lang: Lang): Rendered {
  return lang === "fr"
    ? { title: "WoWLocker", body: "Notifications activées ✓" }
    : { title: "WoWLocker", body: "Notifications enabled ✓" };
}
