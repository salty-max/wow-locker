import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
 */
export function useTooltip(render: () => ReactNode) {
  const anchorRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
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

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Content that loads after opening (an item's details) changes the size:
  // keep it on screen.
  useEffect(() => {
    const el = tipRef.current;
    if (!open || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, place]);

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
      if (e.pointerType === "mouse") setOpen(false);
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

  const node = open
    ? createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className="pointer-events-auto fixed z-[60] w-max max-w-72 rounded-[5px] border border-[#5a6275] bg-[#070a18]/95 px-3 py-2 text-[13px] leading-snug text-white shadow-[0_0_0_1px_#000,0_8px_24px_rgb(0_0_0/0.7)] backdrop-blur-sm"
          style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
        >
          {render()}
        </div>,
        document.body,
      )
    : null;

  return { anchor, node };
}
