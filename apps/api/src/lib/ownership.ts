import type { Flavour, Region } from "@wow-locker/shared";
import type { AccountRow, CompanionLinkRow } from "@/db/schema";

/** Uploads use proof from pairing or a later login, never the uploaded name alone. */
export function ownedCharacter(
  region: Region,
  id: number,
  paired: CompanionLinkRow["owned"],
  fresh?: AccountRow["owned"][number],
): CompanionLinkRow["owned"][number] | undefined {
  if (fresh?.region === region && fresh.ids.includes(id)) {
    const character = fresh.characters?.find((c) => c.id === id);
    if (character) return character;
  }
  return paired.find((c) => c.id === id);
}

type OwnedEntry = AccountRow["owned"][number];

/**
 * An account's proof for one region after Ravenpost's sign-in. The passport
 * lists Classic Era's profile only (`classic1x`), so it replaces just that
 * flavour's characters and keeps the ids and characters of the others.
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
): OwnedEntry {
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
