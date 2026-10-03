import type { CharacterDetail, CharacterEvent, EquippedItem, Quality } from "@wow-locker/shared";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ItemTooltip } from "@/components/ItemTooltip";
import { Money } from "@/components/Money";
import { useLang, useT } from "@/lib/i18n";
import { useTooltip } from "@/lib/useTooltip";

/**
 * The timeline as a WoW chat frame: translucent black, condensed outlined
 * text, [timestamps], oldest first and scrolled to the bottom, every event in
 * the game's own wording and colours.
 */

// The game's chat colours.
const SYSTEM = "#ffff00";
const LOOT = "#00aa00";
const GUILD = "#40ff40";
const DEATH = "#ff2020";
const SKILL = "#5555ff"; // skill-up messages
const FACTION = "#8080ff"; // reputation messages
const DANGER = "#ff8000";
const MUTED = "#a0a0a0";

/** Copper → the game's gold/silver/copper split. */
const coins = (copper: number) => ({
  gold: Math.floor(copper / 10000),
  silver: Math.floor(copper / 100) % 100,
  copper: copper % 100,
});

function duration(seconds: number, lang: "en" | "fr"): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}${lang === "fr" ? "" : " min"}`;
}

function stamp(iso: string, lang: "en" | "fr"): string {
  const d = new Date(iso);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const day = d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `[${day} ${time}]`;
}

/** An item link: [Name] in its quality colour, with the tooltip when it's still equipped. */
function ItemLink({ name, quality, equipped }: { name: string; quality: Quality | null; equipped?: EquippedItem }) {
  const tip = useTooltip(() => (equipped ? <ItemTooltip item={equipped} /> : null));
  return (
    <span
      {...(equipped ? tip.anchor : {})}
      tabIndex={equipped ? 0 : undefined}
      className="q cursor-default outline-none"
      data-q={quality ?? "common"}
    >
      [{name}]{equipped && tip.node}
    </span>
  );
}

function Line({ e, c }: { e: CharacterEvent; c: CharacterDetail }) {
  const t = useT();
  const lang = useLang();
  const d = e.data;
  const name = c.name;
  const msg = t.chat;
  let lines: { color: string; text: ReactNode }[];

  switch (d.type) {
    case "tracked":
      lines = [{ color: SYSTEM, text: msg.tracked(name, d.level) }];
      break;
    case "level": {
      // One line per level gained, like the game (capped for big jumps).
      const levels = Array.from({ length: d.to - d.from }, (_, i) => d.from + 1 + i).slice(-10);
      lines = levels.map((l) => ({ color: SYSTEM, text: msg.level(l) }));
      break;
    }
    case "death":
      // The addon knows who did it and where; the API only knows it happened.
      lines = [
        {
          color: DEATH,
          text:
            d.killer || d.zone || d.instance
              ? msg.slain(name, d.level, c.race, c.className, d.killer ?? null, d.instance ?? d.zone ?? null)
              : msg.death(name, d.level, c.race, c.className),
        },
      ];
      break;
    case "gear":
      lines = d.changes.map((ch) =>
        ch.to
          ? {
              color: LOOT,
              text: (
                <>
                  {msg.equips(name)}
                  <ItemLink name={ch.to} quality={ch.quality} equipped={c.equipment.find((i) => i.slot === ch.slot && i.name === ch.to)} />.
                </>
              ),
            }
          : { color: LOOT, text: <>{msg.unequips(name)}[{ch.from}].</> },
      );
      break;
    case "respec":
      lines = [
        { color: SYSTEM, text: msg.respec },
        { color: SYSTEM, text: msg.talents(d.to.map((x) => `${x.name} ${x.points}`).join(" / ")) },
      ];
      break;
    case "guild":
      lines = [{ color: GUILD, text: d.to ? msg.guildJoined(name, d.to) : msg.guildLeft(name, d.from ?? "") }];
      break;
    case "selfFoundLost":
      lines = [{ color: SYSTEM, text: msg.selfFoundLost(name) }];
      break;
    case "missing":
      lines = [
        { color: SYSTEM, text: msg.missing(name) },
        { color: MUTED, text: msg.missingHint },
      ];
      break;
    case "found":
      lines = [{ color: SYSTEM, text: msg.online(name) }];
      break;
    case "session":
      lines = [{ color: SYSTEM, text: d.action === "login" ? msg.online(name) : msg.offline(name) }];
      break;
    case "talent":
      lines = [{ color: SYSTEM, text: msg.talentPoints(d.trees.map((x) => `${x.name} ${x.points}`).join(" / ")) }];
      break;
    case "quest":
      if (d.action === "accept") {
        lines = [{ color: SYSTEM, text: msg.questAccepted(d.title ?? `#${d.questId}`) }];
        break;
      }
      lines = [
        { color: SYSTEM, text: msg.questDone(d.title ?? `#${d.questId}`) },
        ...(d.xp ? [{ color: SYSTEM, text: msg.xpGained(d.xp.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")) }] : []),
        ...(d.money
          ? [
              {
                color: SYSTEM,
                text: (
                  <>
                    {msg.received}
                    <Money {...coins(d.money)} />
                  </>
                ),
              },
            ]
          : []),
      ];
      break;
    case "closeCall":
      lines = [{ color: DANGER, text: msg.closeCall(name, d.pct, d.attacker, d.instance ?? d.zone) }];
      break;
    case "dungeon":
      lines = [
        {
          color: SYSTEM,
          text:
            d.action === "enter"
              ? msg.dungeonEnter(d.name, d.group.join(", "))
              : msg.dungeonLeave(d.name, duration(d.duration ?? 0, lang), d.deaths ?? 0, d.closeCalls ?? 0),
        },
      ];
      break;
    case "loot":
      lines = [
        {
          color: LOOT,
          text: (
            <>
              {msg.lootSelf[d.how]}
              <ItemLink name={d.name} quality={d.quality} />
              {d.count > 1 ? `x${d.count}` : ""}.
            </>
          ),
        },
      ];
      break;
    case "skill":
      lines = [{ color: SKILL, text: d.learned ? msg.skillLearned(d.name) : msg.skillUp(d.name, d.rank) }];
      break;
    case "reputation":
      lines = [{ color: FACTION, text: msg.reputation(d.label ?? String(d.standing), d.faction) }];
      break;
    case "reminder":
      lines = [
        {
          color: d.kind === "mailExpiring" ? DANGER : SYSTEM,
          text:
            d.kind === "mailExpiring"
              ? msg.mailExpiring(d.detail ?? "—", d.count ?? 0, d.onExpiry === "returned")
              : d.kind === "rested"
                ? msg.rested(name)
                : msg.cooldownReady(d.detail ?? "—"),
        },
      ];
      break;
  }

  return (
    <>
      {lines.map((l, i) => (
        <p key={i} style={{ color: l.color }}>
          <span className="text-[#a0a0a0]">{stamp(e.at, lang)} </span>
          {l.text}
        </p>
      ))}
    </>
  );
}

export function ChatLog({ c }: { c: CharacterDetail }) {
  const box = useRef<HTMLDivElement>(null);
  const events = [...c.events].reverse(); // the API sends newest first; chat reads oldest → newest

  useLayoutEffect(() => {
    // Like the chat frame: always showing the latest line.
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [c.events.length]);

  return (
    <div>
      <div
        ref={box}
        className="max-h-72 overflow-y-auto rounded border border-[#3a3a3a] bg-black/55 px-3 py-2 font-[Arial_Narrow,Roboto_Condensed,Arial,sans-serif] text-[14px] leading-[1.35] tracking-[0.01em] [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000] [scrollbar-color:#5a5a5a_transparent]"
      >
        {events.map((e) => (
          <Line key={e.id} e={e} c={c} />
        ))}
      </div>
    </div>
  );
}
