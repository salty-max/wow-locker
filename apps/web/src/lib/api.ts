import type {
  AccountImport,
  AddCharacterRequest,
  CharacterDetail,
  CharacterSummary,
  Flavour,
  ItemMatch,
  ItemTooltip,
  Me,
  Memorial,
  Realm,
  Region,
} from "@wow-locker/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `${res.status}`);
  }
  return (await res.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  me: () => req<Me | null>("/api/me"),
  saveRoster: (ids: number[]) => req<Me>("/api/me/roster", json("PUT", { ids })),
  saveSettings: (patch: { lang?: string; events?: string[] }) => req<Me>("/api/me/settings", json("PUT", patch)),
  logout: () => req<{ ok: true }>("/api/me/logout", json("POST")),
  deleteAccount: () => req<{ ok: true }>("/api/me", json("DELETE")),
  setSharing: (id: number, shared: boolean) => req<{ shared: boolean }>(`/api/characters/${id}/sharing`, json("PUT", { shared })),
  realms: (region: Region) => req<Realm[]>(`/api/realms?region=${region}`),
  characters: (ids: number[]) => req<CharacterSummary[]>(`/api/characters?ids=${ids.join(",")}`),
  character: (id: number) => req<CharacterDetail>(`/api/characters/${id}`),
  memorial: (ids: number[]) => req<Memorial>(`/api/memorial?ids=${ids.join(",")}`),
  itemTooltip: (region: Region, flavour: Flavour, id: number) =>
    req<{ tooltip: ItemTooltip | null }>(`/api/item-tooltip/${region}/${flavour}/${id}`).then((r) => r.tooltip),
  items: (ids: number[], q: string) => req<ItemMatch[]>(`/api/items?ids=${ids.join(",")}&q=${encodeURIComponent(q)}`),
  accountImport: (k: string) => req<AccountImport>(`/api/auth/import/${encodeURIComponent(k)}`),
  /** Full-page navigation: Blizzard's login page, then back to /import. */
  loginUrl: (region: Region) => `/api/auth/login?region=${region}`,
  add: (body: AddCharacterRequest) =>
    req<CharacterSummary>("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
