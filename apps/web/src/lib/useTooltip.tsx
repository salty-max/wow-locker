import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * WoW-style tooltip, driven by a hook so it can attach to any element (even an
 * absolutely-positioned talent button) without a wrapper:
 *
 *   const tip = useTooltip(() => <ItemTooltip item={i} />);
 *   <li {...tip.anchor}>…</li>
 *   {tip.node}
 *
 * Mouse: shows on hover. Touch: tap toggles, tapping elsewhere closes.
 * Keyboard: shows on focus. It sits beside the anchor (right, else left, else
 * below) and is clamped to the viewport.
 *
 * Transitions: it fades in once placed and fades out quickly; when its content
 * grows (an item's details arriving) it glides to its new place instead of
 * jumping. Sweeping across slots hands over "warm": a tooltip opening right
 * after another closed shows at once, like the game's. Reduced motion: none.
 */

const FADE_OUT_MS = 80;
const WARM_MS = 250; // another tooltip closed this recently: no fade-in
let lastClosedAt = 0;
// Tooltips still fading out: a new one opening removes them at once, so two
// never overlap (the game shows one at a time).
const fadingOut = new Set<() => void>();

export function useTooltip(render: () => ReactNode) {
  const anchorRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  // mounted: in the DOM (it stays a moment after closing, to fade out);
  // shown: visible; warm: shown at once, no fade-in.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [warm, setWarm] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const a = anchorRef.current?.getBoundingClientRect();
    const t = tipRef.current;
    if (!a || !t) return;
    const { width, height } = t.getBoundingClientRect();
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = a.right + gap;
    let top = a.top;
    if (left + width > vw - gap) left = a.left - width - gap;
    if (left < gap) {
      // No room on either side (phones): below the anchor, centred.
      left = Math.min(Math.max(gap, a.left + a.width / 2 - width / 2), vw - width - gap);
      top = a.bottom + gap;
      if (top + height > vh - gap) top = a.top - height - gap;
    }
    top = Math.min(Math.max(gap, top), vh - height - gap);
    setPos({ left, top });
  }, []);

  // Open: mount invisible and unplaced. Close: fade out, then unmount.
  useLayoutEffect(() => {
    if (open) {
      fadingOut.forEach((finish) => finish());
      setWarm(Date.now() - lastClosedAt < WARM_MS);
      setPos(null);
      setShown(false);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    lastClosedAt = Date.now();
    setShown(false);
    const finish = () => {
      clearTimeout(id);
      fadingOut.delete(finish);
      setMounted(false);
    };
    const id = setTimeout(finish, FADE_OUT_MS);
    fadingOut.add(finish);
    return () => {
      clearTimeout(id);
      fadingOut.delete(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open / close
  }, [open]);

  // Mounted and open: place it, then show it on the next frame, so the browser
  // has the hidden, placed state to transition from.
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    place();
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open, mounted, place]);

  // Content that loads after opening (an item's details) changes the size:
  // keep it on screen (it glides there, see the transition below).
  useEffect(() => {
    const el = tipRef.current;
    if (!open || !mounted || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mounted, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as Node;
      if (!anchorRef.current?.contains(target) && !tipRef.current?.contains(target)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const hide = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", hide, { capture: true });
    };
  }, [open]);

  const lastPointer = useRef<string>("mouse");
  const anchor = {
    ref: (el: HTMLElement | null) => {
      anchorRef.current = el;
    },
    onPointerEnter: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
      if (e.pointerType === "mouse") setOpen(true);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      // Stamped here, not in the close effect: leaving this slot always fires
      // before entering the next, so the next tooltip reliably sees it as warm.
      lastClosedAt = Date.now();
      setOpen(false);
    },
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    onClick: () => {
      if (lastPointer.current !== "mouse") setOpen((o) => !o);
    },
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  // Which transition applies:
  //  - showing (cold): fade in + 3px rise, 120 ms;
  //  - showing (warm): no fade, only position changes glide;
  //  - visible: position changes glide (content growing);
  //  - closing: quick fade out.
  const transition = shown
    ? warm
      ? "transition-[left,top] duration-[120ms] ease-out"
      : "transition-[opacity,transform,left,top] duration-[120ms] ease-out"
    : open
      ? "transition-none"
      : "transition-opacity duration-[80ms] ease-in";
  // Warm: visible as soon as it's placed, no waiting for the fade.
  const visible = shown || (warm && open && pos != null);

  const node = mounted
    ? createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className={cn(
            "fixed z-[60] w-max max-w-72 rounded-[5px] border border-[#5a6275] bg-[#070a18]/95 px-3 py-2 text-[13px] leading-snug text-white shadow-[0_0_0_1px_#000,0_8px_24px_rgb(0_0_0/0.7)] backdrop-blur-sm motion-reduce:transition-none",
            transition,
            visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            shown || warm ? "translate-y-0" : "translate-y-[3px]",
          )}
          style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
        >
          {render()}
        </div>,
        document.body,
      )
    : null;

  return { anchor, node };
}
