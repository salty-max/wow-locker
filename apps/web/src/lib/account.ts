import type { Me } from "@wow-locker/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { roster } from "@/lib/roster";
import { settings } from "@/lib/settings";
import { createStore } from "@/lib/store";

/**
 * The logged-in account (a session cookie set by the Battle.net login), and
 * keeping this device's roster and settings in step with it.
 *
 * The local stores stay what the UI reads and writes (they also serve guests).
 * While logged in:
 *   - the first login on a device merges: the account's locker, then this
 *     device's extra characters; the account's settings win once it has some;
 *   - a local change is sent to the account (debounced);
 *   - a change made elsewhere (seen when /api/me is fetched again) replaces
 *     the local copy.
 * Logging out keeps the local copy: the device goes back to being a guest.
 */

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.me, staleTime: 30_000, refetchInterval: 5 * 60_000 });
}

/** The account this device last merged with (a later login of another one merges again). */
const merged = createStore<{ id: number | null }>("wow-locker:account-merged", { id: null });

/** The account's order first, then what only this device had. */
export function mergeRosters(account: number[], device: number[], max = 50): number[] {
  return [...new Set([...account, ...device])].slice(0, max);
}

const settingsKey = (s: { lang: unknown; events: unknown }) => JSON.stringify({ lang: s.lang, events: s.events });

// What the account holds, as last seen or last sent (null: logged out).
let server: { roster: string; settings: string } | null = null;

/** Apply /api/me to the local stores (see above). */
export function applyMe(me: Me | null): void {
  if (!me) {
    server = null;
    return;
  }
  const accountRoster = JSON.stringify(me.roster);
  const accountSettings = settingsKey(me);
  const first = merged.get().id !== me.id;
  if (first) {
    merged.set({ id: me.id });
    server = { roster: accountRoster, settings: accountSettings };
    // The merged roster differs from the account's: the store listener sends it.
    roster.set({ ids: mergeRosters(me.roster, roster.get().ids) });
    if (me.lang && me.events) settings.set((s) => ({ ...s, lang: me.lang!, events: me.events! }));
    else void push.settings(); // a new account: this device's settings become its own
    return;
  }
  // A change of ours still on its way: the account's copy is about to catch up.
  if (pending > 0) return;
  const remoteRoster = !server || server.roster !== accountRoster;
  const remoteSettings = !server || server.settings !== accountSettings;
  server = { roster: accountRoster, settings: accountSettings };
  if (remoteRoster) roster.set({ ids: me.roster });
  if (remoteSettings && me.lang && me.events) settings.set((s) => ({ ...s, lang: me.lang!, events: me.events! }));
}

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
let pending = 0; // changes scheduled or being sent
const debounce = (key: string, send: () => Promise<unknown>, ms = 400) => {
  if (timers[key]) clearTimeout(timers[key]);
  else pending++;
  timers[key] = setTimeout(() => {
    delete timers[key];
    void send()
      .catch(() => {})
      .finally(() => pending--);
  }, ms);
};

const push = {
  roster: () => {
    if (!server) return;
    const ids = roster.get().ids;
    const now = JSON.stringify(ids);
    if (now === server.roster) return;
    server.roster = now;
    debounce("roster", () => api.saveRoster(ids));
  },
  settings: () => {
    if (!server) return;
    const s = settings.get();
    const now = settingsKey(s);
    if (now === server.settings) return;
    server.settings = now;
    debounce("settings", () => api.saveSettings({ lang: s.lang, events: s.events }));
  },
};

/** In the layout: keeps the stores and the account in step. */
export function useAccountSync(): Me | null | undefined {
  const me = useMe().data;
  useEffect(() => applyMe(me ?? null), [me]);
  useEffect(() => {
    const a = roster.subscribe(push.roster);
    const b = settings.subscribe(push.settings);
    return () => {
      a();
      b();
    };
  }, []);
  return me;
}

/** Log out: the session ends; this device keeps its copy of the locker. */
export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api.logout().catch(() => {});
    merged.set({ id: null });
    applyMe(null);
    qc.setQueryData(ME_KEY, null);
    // The service worker keeps API answers for offline use: drop the owner's.
    await globalThis.caches?.delete("api").catch(() => false);
    // Others' private details were visible as the owner: fetch again as a guest.
    await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  };
}
