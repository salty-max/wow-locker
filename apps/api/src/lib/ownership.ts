import type { Flavour, Region } from "@wow-locker/shared";
import type { AccountRow, CompanionLinkRow } from "@/db/schema";

/**
 * Uploads use proof from pairing or a later login, never the uploaded name alone.
 * `realmId` is the GUID's realm part: a Forever character matches on it as well
 * as on its id (a Forever id and a Classic id come from counters we can't see,
 * so ids alone never cross the two games), a Classic one never matches a Forever entry.
 */
export function ownedCharacter(
  region: Region,
  id: number,
  paired: CompanionLinkRow["owned"],
  fresh?: AccountRow["owned"][number],
  realmId?: number,
): CompanionLinkRow["owned"][number] | undefined {
  if (fresh?.region === region) {
    const forever = fresh.characters?.find((c) => c.flavour === "forever" && c.id === id && realmId != null && c.realmSlug === String(realmId));
    if (forever) return forever;
    if (fresh.ids.includes(id)) {
      const character = fresh.characters?.find((c) => c.flavour !== "forever" && c.id === id);
      if (character) return character;
    }
  }
  return paired.find((c) => c.flavour !== "forever" && c.id === id);
}

type OwnedEntry = AccountRow["owned"][number];

/**
 * An account's proof for one region after Ravenpost's sign-in. The passport
 * carries Classic Era's list (`classic1x`) and Forever's (`game: "forever"`) as
 * separate entries: each replaces just its own flavour's characters and keeps
 * the others'. Forever's ids stay out of `ids` (that list is Classic's, what
 * "gone" is read from: a Forever character is never judged by it) and live in
 * `characters` with the pseudo-realm id as `realmSlug`.
 * `at` and `unavailable` stay what the last login on the site made them: that
 * list is the one that can call a deleted character gone (a refresh dated now
 * would hide it, and a character it hasn't listed yet could never tell new
 * from deleted). A region the site never logged in for starts with the
 * other flavours unavailable, so none reads as gone.
 */
export function refreshedOwned(
  old: OwnedEntry | undefined,
  region: Region,
  ids: number[],
  characters: [number, string, string][],
  now: Date,
  game: "classic1x" | "forever" = "classic1x",
): OwnedEntry {
  if (game === "forever") {
    const kept = (old?.characters ?? []).filter((c) => c.flavour !== "forever");
    const forever = characters.map(([id, realmSlug, name]) => ({ id, flavour: "forever" as const, realmSlug, name }));
    return {
      region,
      ids: old?.ids ?? [],
      characters: [...kept, ...forever],
      at: old?.at ?? now.toISOString(),
      // (a region the site never logged in for has no Classic list yet: it can't call anything gone)
      unavailable: old?.at != null ? (old.unavailable ?? []) : [...new Set<Flavour>([...(old?.unavailable ?? []), "classic1x", "classicann", "classic"])],
    };
  }
  const oldEra = new Set((old?.characters ?? []).filter((c) => c.flavour === "classic1x").map((c) => c.id));
  const keptIds = (old?.ids ?? []).filter((id) => !oldEra.has(id));
  const kept = (old?.characters ?? []).filter((c) => c.flavour !== "classic1x");
  const era = characters.map(([id, realmSlug, name]) => ({ id, flavour: "classic1x" as const, realmSlug, name }));
  const dated = old?.at != null;
  return {
    region,
    ids: [...new Set([...keptIds, ...ids])],
    characters: [...kept, ...era],
    at: dated ? old.at : now.toISOString(),
    unavailable: dated ? (old.unavailable ?? []) : [...new Set<Flavour>([...(old?.unavailable ?? []), "classicann", "classic"])],
  };
}
