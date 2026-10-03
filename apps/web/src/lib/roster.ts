import { createStore } from "@/lib/store";

/**
 * This device's locker: the ids of the characters it tracks, in display order.
 * The server tracks characters for everyone; the roster is what this device
 * shows (and gets notified about). Kept locally, like Farseer's saved posts.
 */
type Roster = { ids: number[] };

export const roster = createStore<Roster>("wow-locker:roster", { ids: [] }, (raw) => {
  const ids = (raw as Roster | null)?.ids;
  return { ids: Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n) && n > 0) : [] };
});

export const useRoster = roster.use;

export function addToRoster(id: number): void {
  roster.set((r) => (r.ids.includes(id) ? r : { ids: [...r.ids, id] }));
}

export function removeFromRoster(id: number): void {
  roster.set((r) => ({ ids: r.ids.filter((x) => x !== id) }));
}

/** `ids` with `id` moved to position `to` (clamped). */
export function moveTo(ids: number[], id: number, to: number): number[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * Where a dragged row lands: the number of other rows whose middle is above
 * the pointer. `middles` are the other rows' vertical centres, in order.
 */
export function dropIndex(middles: number[], y: number): number {
  return middles.filter((m) => m < y).length;
}

export function setRosterOrder(ids: number[]): void {
  roster.set((r) => (ids.length === r.ids.length && ids.every((id) => r.ids.includes(id)) ? { ids } : r));
}

export function moveInRoster(id: number, delta: -1 | 1): void {
  roster.set((r) => {
    const i = r.ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= r.ids.length) return r;
    const ids = [...r.ids];
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return { ids };
  });
}
