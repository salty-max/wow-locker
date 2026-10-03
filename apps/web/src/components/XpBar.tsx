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

  return (
    <div className="w-full">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[2px] border border-[#6b5a35] bg-[linear-gradient(to_bottom,#15141c,#0c0b12)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.9)]",
          compact ? "h-1.5" : "h-2.5",
        )}
        title={label}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={xp}
        aria-label={label}
      >
        {/* the rested bonus: a dim blue band from the current XP on */}
        {isRested && (
          <div
            className="absolute inset-y-0 bg-[linear-gradient(to_bottom,#2a4c9c_0%,#17306b_100%)] opacity-70"
            style={{ left: `${pct}%`, width: `${restedEnd - pct}%` }}
          />
        )}
        {/* fill: WoW's XP purple, blue while rested, with a glossy top half */}
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            isRested
              ? "bg-[linear-gradient(to_bottom,#5d8cff_0%,#1f4fd1_45%,#12318f_100%)]"
              : "bg-[linear-gradient(to_bottom,#c64fd0_0%,#8e1c96_45%,#6a0d72_100%)]",
          )}
          style={{ width: `${pct}%` }}
        />
        {/* 20 bubbles: dividers in the frame's bronze, over empty and full alike */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(5%-1.5px),#6b5a35_calc(5%-1.5px),#6b5a35_5%)]" />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.06]" />
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
