import { AlertTriangle, Skull, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { MapMarker } from "@/lib/maps";
import { useDialog } from "@/lib/useDialog";
import { useT } from "@/lib/i18n";

/**
 * A zone's in-game map (public/maps/<uiMapID>.webp, built by scripts/maps.py)
 * with markers at the addon's coordinates (0–100 % of the map, as the game
 * gives them). Opened from the location and from deaths / close calls.
 */

// Bump when scripts/maps.py output changes: opened maps are cached on devices.
const MAPS_VERSION = 2;

function Marker({ m }: { m: MapMarker }) {
  const icon: ReactNode =
    m.kind === "player" ? (
      // The player: a gold dot with a pulsing ring, like the map's player pin.
      <span className="relative block size-3.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#ffd100]/60" />
        <span className="absolute inset-0 rounded-full border-2 border-black bg-[#ffd100] shadow-[0_0_6px_#ffd100]" />
      </span>
    ) : m.kind === "death" ? (
      <Skull className="size-5 text-[#ff3030] drop-shadow-[0_1px_1px_#000]" strokeWidth={2.5} />
    ) : (
      <AlertTriangle className="size-4 text-[#ff8000] drop-shadow-[0_1px_1px_#000]" strokeWidth={2.5} />
    );
  return (
    <span
      role="img"
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${m.x}%`, top: `${m.y}%` }}
      title={m.label}
      aria-label={m.label}
    >
      {icon}
    </span>
  );
}

export function MapPopup({ mapId, title, markers, onClose }: { mapId: number; title: string; markers: MapMarker[]; onClose: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div ref={box} className="wow-frame w-full max-w-[1002px] px-2 pt-8 pb-2 sm:px-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="wow-title">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.map.close}
          className="wow-btn wow-btn-sm wow-btn-dark absolute top-2 right-2 !px-1.5"
        >
          <X className="size-4" />
        </button>
        <div className="relative aspect-[1002/668] w-full overflow-hidden rounded-[3px] border border-black">
          <img src={`/maps/${mapId}.webp?v=${MAPS_VERSION}`} alt="" className="size-full" />
          {markers.map((m, i) => (
            <Marker key={i} m={m} />
          ))}
        </div>
        {markers.length === 0 && <p className="mt-2 px-1 text-xs text-ink-faint">{t.map.noPosition}</p>}
        {markers.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-dim">
            {markers.map((m, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className={m.kind === "player" ? "text-[#ffd100]" : m.kind === "death" ? "text-[#ff3030]" : "text-[#ff8000]"}>
                  {m.kind === "player" ? "●" : m.kind === "death" ? "☠" : "▲"}
                </span>
                {m.label}
                <span className="text-ink-faint tabular-nums">
                  ({m.x.toFixed(0)}, {m.y.toFixed(0)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
