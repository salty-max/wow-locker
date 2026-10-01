import type { CharacterDetail, CharacterEvent, EquippedItem, Quality } from "@wow-locker/shared";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ItemTooltip } from "@/components/ItemTooltip";
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
      lines = [{ color: DEATH, text: msg.death(name, d.level, c.race, c.className) }];
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
        { color: "#a0a0a0", text: msg.missingHint },
      ];
      break;
    case "found":
      lines = [{ color: SYSTEM, text: msg.online(name) }];
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
