import { useSyncExternalStore } from "react";

/**
 * A tiny persisted store (localStorage + in-memory fallback) with a React hook.
 * Every read/write is guarded: private mode or blocked storage must never break
 * the app, it just stops remembering.
 */
export function createStore<T>(key: string, initial: T, migrate?: (raw: unknown) => T) {
  let value: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) value = migrate ? migrate(JSON.parse(raw)) : { ...initial, ...JSON.parse(raw) };
  } catch {
    /* keep the default */
  }
  const listeners = new Set<() => void>();
  const get = () => value;
  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not persisted */
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const use = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, subscribe, use };
}
