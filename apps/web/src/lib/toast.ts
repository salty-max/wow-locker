import { useSyncExternalStore } from "react";

/** In-app toasts: a tiny store; <Toaster /> in the layout renders them. */
export type Toast = { id: number; title: string; body?: string; href?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<Toast, "id">, ms = 6000): void {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { ...t, id }]; // three at most
  emit();
  setTimeout(() => dismiss(id), ms);
}

export function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
