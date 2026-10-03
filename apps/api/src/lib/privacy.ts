import type { AddonState, CharacterEvent } from "@wow-locker/shared";
import type { CharacterRow } from "@/db/schema";

/**
 * What a viewer may see of a character. Characters nobody has claimed (no
 * owner: tracked by name, or not logged in yet) are public as before. An
 * owned character keeps its private details — bags, bank, mail, gold, crafts
 * and where it stands — for its owner, unless the owner shared it. Level,
 * gear, talents, the timeline and Hardcore deaths stay public.
 */
export type Viewer = { accountId: number } | null;

export const isMine = (c: Pick<CharacterRow, "ownerId">, v: Viewer) => v != null && c.ownerId === v.accountId;

export const canSeePrivate = (c: Pick<CharacterRow, "ownerId" | "shared">, v: Viewer) => c.ownerId == null || c.shared || isMine(c, v);

/** The addon state with the private parts emptied. */
export function publicAddon(a: AddonState): AddonState {
  return {
    ...a,
    money: null,
    zone: null,
    subZone: null,
    x: null,
    y: null,
    mapId: null,
    run: null,
    mail: null,
    cooldowns: [],
    bags: [],
    bank: null,
  };
}

/** Timeline events with the private parts removed: reminders (mail subjects, crafts), gold won. */
export function publicEvents(events: CharacterEvent[]): CharacterEvent[] {
  return events
    .filter((e) => e.data.type !== "reminder")
    .map((e) => (e.data.type === "session" && e.data.recap ? { ...e, data: { ...e.data, recap: { ...e.data.recap, money: null } } } : e));
}
