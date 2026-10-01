import type { Flavour, Region } from "@wow-locker/shared";
import { log } from "@/lib/log";

/**
 * Battle.net API client (client-credentials). Shared pacing + retries, as in
 * Farseer's forum client: Blizzard documents ~36k requests/hour and 100/s per
 * client, we stay far below with one request every 150 ms at most.
 */

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchFn = (input, init) => fetch(input, init);
export function setFetch(f: FetchFn): void {
  fetchImpl = f;
}

export const DEFAULT_PACE_MS = 150;
let paceMs = DEFAULT_PACE_MS;
let nextSlot = 0;
let queue: Promise<void> = Promise.resolve();
export function setPace(ms: number): number {
  const prev = paceMs;
  paceMs = ms;
  return prev;
}
function paced(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = nextSlot - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nextSlot = Date.now() + paceMs;
  });
  queue = turn.catch(() => {});
  return turn;
}

let token: { value: string; expiresAt: number } | null = null;

export function credentials(): { id: string; secret: string } | null {
  const id = process.env.BNET_CLIENT_ID;
  const secret = process.env.BNET_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const c = credentials();
  if (!c) throw new Error("BNET_CLIENT_ID / BNET_CLIENT_SECRET not set");
  const res = await fetchImpl("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${c.id}:${c.secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`oauth token → ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expiresAt: Date.now() + (j.expires_in - 120) * 1000 };
  return token.value;
}

export class BnetError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`GET ${path} → ${status}`);
  }
}

const RETRY_DELAYS_MS = [1_000, 4_000];

/** GET a namespaced API path. 404 throws BnetError without retrying. Pass
 *  `userToken` to call as a logged-in user (account endpoints). */
export async function bnet<T>(region: Region, path: string, namespace: string, userToken?: string): Promise<T> {
  const url = `https://${region}.api.blizzard.com${path}${path.includes("?") ? "&" : "?"}namespace=${namespace}&locale=en_GB`;
  for (let attempt = 0; ; attempt++) {
    await paced();
    let status = 0;
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${userToken ?? (await accessToken())}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return (await res.json()) as T;
      status = res.status;
      if (status === 401 && !userToken) token = null; // expired early: fetch a new one and retry
      if (status === 429) log.warn("bnet.rate_limited", { path, attempt: attempt + 1 });
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
    }
    const retryable = status === 0 || (status === 401 && !userToken) || status === 429 || status >= 500;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw new BnetError(path, status);
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
}

export const ns = {
  dynamic: (f: Flavour, r: Region) => `dynamic-${f}-${r}`,
  profile: (f: Flavour, r: Region) => `profile-${f}-${r}`,
  static: (f: Flavour, r: Region) => `static-${f}-${r}`,
};

const charPath = (realm: string, name: string, sub = "") =>
  `/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(name.toLowerCase())}${sub}`;

export const api = {
  realmSearch: (f: Flavour, r: Region) =>
    bnet<{ results: { data: RealmSearchData }[] }>(r, "/data/wow/search/realm?_pageSize=1000", ns.dynamic(f, r)),
  summary: (f: Flavour, r: Region, realm: string, name: string) =>
    bnet<RawSummary>(r, charPath(realm, name), ns.profile(f, r)),
  equipment: (f: Flavour, r: Region, realm: string, name: string) =>
    bnet<RawEquipment>(r, charPath(realm, name, "/equipment"), ns.profile(f, r)),
  specializations: (f: Flavour, r: Region, realm: string, name: string) =>
    bnet<RawSpecializations>(r, charPath(realm, name, "/specializations"), ns.profile(f, r)),
  statistics: (f: Flavour, r: Region, realm: string, name: string) =>
    bnet<RawStatistics>(r, charPath(realm, name, "/statistics"), ns.profile(f, r)),
  media: (f: Flavour, r: Region, realm: string, name: string) =>
    bnet<RawMedia>(r, charPath(realm, name, "/character-media"), ns.profile(f, r)),
  itemMedia: (f: Flavour, r: Region, itemId: number) =>
    bnet<RawMedia>(r, `/data/wow/media/item/${itemId}`, ns.static(f, r)),
};

// ── OAuth (authorization code flow, for "Log in with Battle.net") ────────────

export function authorizeUrl(redirectUri: string, state: string): string {
  const c = credentials();
  if (!c) throw new Error("BNET_CLIENT_ID / BNET_CLIENT_SECRET not set");
  const q = new URLSearchParams({
    client_id: c.id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "wow.profile",
    state,
  });
  return `https://oauth.battle.net/authorize?${q}`;
}

/** Exchange a one-time code for the user's access token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const c = credentials();
  if (!c) throw new Error("BNET_CLIENT_ID / BNET_CLIENT_SECRET not set");
  const res = await fetchImpl("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${c.id}:${c.secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`oauth code exchange → ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** The logged-in user's BattleTag (works with any user token). */
export async function userInfo(userToken: string): Promise<{ battletag?: string }> {
  const res = await fetchImpl("https://oauth.battle.net/userinfo", {
    headers: { Authorization: `Bearer ${userToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok ? ((await res.json()) as { battletag?: string }) : {};
}

export type RawAccountProfile = {
  wow_accounts?: {
    characters?: {
      name: string;
      level: number;
      realm: { slug: string; name: string };
      playable_class: { id: number; name: string };
      faction: { type: string };
    }[];
  }[];
};

export const accountProfile = (f: Flavour, r: Region, userToken: string) =>
  bnet<RawAccountProfile>(r, "/profile/user/wow", ns.profile(f, r), userToken);

// ── raw shapes (only the fields we read) ─────────────────────────────────────

type Named = { name: string; id?: number; type?: string };
export type RealmSearchData = {
  slug: string;
  name: Record<string, string>;
  category: Record<string, string>;
  type: { type: string; name: Record<string, string> };
};
export type RawSummary = {
  id: number;
  name: string;
  gender: { type: string; name: string };
  faction: { type: string; name: string };
  race: Named;
  character_class: Named;
  realm: { name: string; slug: string };
  guild?: { name: string };
  level: number;
  experience?: number;
  average_item_level?: number;
  equipped_item_level?: number;
  last_login_timestamp?: number;
  is_ghost?: boolean;
  is_self_found?: boolean;
};
export type RawEquipment = {
  equipped_items?: {
    slot: { type: string; name: string };
    item: { id: number };
    quality: { type: string };
    name: string;
    enchantments?: { display_string: string }[];
    binding?: { name: string };
    inventory_type?: { name: string };
    item_subclass?: { name: string };
    armor?: { display?: { display_string: string } };
    weapon?: {
      damage?: { display_string: string };
      attack_speed?: { display_string: string };
      dps?: { display_string: string };
    };
    stats?: { display?: { display_string: string }; is_negated?: boolean }[];
    spells?: { description?: string }[];
    requirements?: { level?: { display_string: string } };
    durability?: { display_string: string };
    sell_price?: { display_strings?: { gold: string; silver: string; copper: string } };
  }[];
};
export type RawSpecializations = {
  specialization_groups?: {
    is_active: boolean;
    specializations?: {
      specialization_name: string;
      spent_points: number;
      talents?: {
        talent: { id: number };
        talent_rank?: number;
        spell_tooltip?: { spell?: { name: string }; description?: string };
      }[];
    }[];
  }[];
};
type StatValue = number | { effective?: number; value?: number };
export type RawStatistics = Record<string, StatValue | { name?: string } | undefined> & {
  power_type?: { name: string };
};
export type RawMedia = { assets?: { key: string; value: string }[] };
