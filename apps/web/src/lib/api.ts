import type { AccountImport, AddCharacterRequest, CharacterDetail, CharacterSummary, Flavour, ItemMatch, ItemTooltip, Realm, Region } from "@wow-locker/shared";

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

export const api = {
  realms: (region: Region) => req<Realm[]>(`/api/realms?region=${region}`),
  characters: (ids: number[]) => req<CharacterSummary[]>(`/api/characters?ids=${ids.join(",")}`),
  character: (id: number) => req<CharacterDetail>(`/api/characters/${id}`),
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
