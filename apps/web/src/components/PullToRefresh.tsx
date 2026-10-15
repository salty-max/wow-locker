import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * On a phone, a pull at the top of the page fetches everything again, as
 * Ravenpost's inbox does: an installed app has no reload of its own. The
 * circle follows the finger, turns gold when letting go will refresh, and
 * spins under the header until the data is back.
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const circle = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = circle.current;
    if (!el) return;
    let y0: number | null = null;
    let dy = 0;
    const start = (e: TouchEvent) => {
      y0 = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      el.style.transition = "opacity 0.15s";
      el.style.opacity = dy > 10 ? "1" : "0";
      el.style.transform = `translateY(${Math.min(dy, 110) * 0.7 - 60}px) rotate(${dy * 2}deg)`;
      el.dataset.ready = dy > 90 ? "1" : "";
    };
    const end = () => {
      if (y0 === null) return;
      const refresh = dy > 90;
      y0 = null;
      dy = 0;
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
      el.dataset.ready = "";
      if (!refresh) return;
      setBusy(true);
      void qc.refetchQueries({ type: "active" }).finally(() => setBusy(false));
    };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", end);
    return () => {
      removeEventListener("touchstart", start);
      removeEventListener("touchmove", move);
      removeEventListener("touchend", end);
    };
  }, [qc]);
  return (
    <div
      ref={circle}
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-1/2 z-40 -ml-5 grid size-10 place-items-center rounded-full border border-edge bg-stone-2 text-ink-dim shadow-[0_6px_18px_rgb(0_0_0/0.45)] transition-[transform,opacity] duration-200 data-[ready=1]:border-edge-gold data-[ready=1]:text-[#ffd100] sm:hidden",
        busy ? "top-[calc(env(safe-area-inset-top)+4.25rem)] translate-y-0 opacity-100" : "top-[env(safe-area-inset-top)] -translate-y-[60px] opacity-0",
      )}
    >
      <RefreshCw className={cn("size-[18px]", busy && "animate-spin")} />
    </div>
  );
}
