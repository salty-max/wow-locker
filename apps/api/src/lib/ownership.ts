import type { Region } from "@wow-locker/shared";
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
