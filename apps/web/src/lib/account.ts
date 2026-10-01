import type { Region } from "@wow-locker/shared";
import { createStore } from "@/lib/store";

/**
 * Who this device last logged in as with Battle.net. Display only: the server
 * keeps no session, so "logging out" just forgets this, and importing again
 * goes back through Blizzard's login (usually instant, Blizzard remembers you).
 */
export type Account = { battletag: string | null; region: Region; at: string } | null;

export const account = createStore<{ current: Account }>("wow-locker:account", { current: null }, (raw) => {
  const c = (raw as { current?: Account } | null)?.current;
  return { current: c && (c.region === "eu" || c.region === "us") ? c : null };
});

export const useAccount = () => account.use().current;
export const setAccount = (current: Account) => account.set({ current });
