import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The in-game experience bar: a long, thin, dark framed track, the purple
 * fill (blue while rested, with the rested bonus shaded ahead of it, as in
 * game; rested XP only comes from the addon) and 20 "bubbles"
 * whose dividers show even when empty. In-game the text only appears on
 * hover; a bar this thin can't hold it, so it sits underneath.
 */
export function XpBar({
  xp,
  max,
  rested = null,
  compact = false,
}: {
  xp: number;
  max: number | null;
  rested?: number | null;
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  if (!max) return null;
  const pct = Math.max(0, Math.min(100, (xp / max) * 100));
  const fmt = (n: number) => n.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
  const label = t.character.xp(fmt(xp), fmt(max));
  const isRested = rested != null && rested > 0;
  const restedEnd = isRested ? Math.min(100, ((xp + rested) / max) * 100) : pct;
  // The game's bar colours (ExpBarOverrides.lua): (0.58, 0, 0.55) and, rested, (0, 0.39, 0.88).
  const tint = isRested ? "0 99 224" : "148 0 140";

  return (
    <div className="w-full">
      <div
        className={cn("relative w-full", compact ? "h-1.5" : "h-2.5")}
        title={label}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={xp}
        aria-label={label}
      >
        {/* As in the game's ExpBar: a half-black background, the UI-StatusBar
            texture tinted purple (blue while rested), the rested bonus as the
            same colour at 15%, the frame with its 20 bubbles on top. */}
        <div className="absolute inset-x-0 inset-y-px bg-black/50" />
        {isRested && (
          <div className="absolute inset-y-px" style={{ left: `${pct}%`, width: `${restedEnd - pct}%`, backgroundColor: `rgb(${tint} / 0.15)` }} />
        )}
        <div
          className="absolute inset-y-px left-0 bg-[url(/ui/statusbar.png)] bg-[length:100%_100%] bg-blend-multiply"
          style={{ width: `${pct}%`, backgroundColor: `rgb(${tint})` }}
        />
        <div className="absolute inset-0 bg-[url(/ui/xp-frame.png)] bg-[length:100%_100%]" />
        {/* The rested marker, where the bonus ends. */}
        {isRested && !compact && (
          <img
            src="/ui/exhaustion-tick.png"
            alt=""
            className="pointer-events-none absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${restedEnd}%` }}
          />
        )}
      </div>
      {!compact && (
        <p className="mt-1 text-right text-[11px] text-ink-faint tabular-nums">
          {label}{" "}
          <span className={isRested ? "text-[#7fa5ff]" : "text-[#c64fd0]"}>({pct < 10 ? pct.toFixed(1) : Math.floor(pct)}%)</span>
          {isRested && (
            <span className="text-[#7fa5ff]">
              {" · "}
              {t.character.rested(fmt(rested), Math.round((rested / max) * 100))}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
