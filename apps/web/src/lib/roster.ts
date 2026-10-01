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
