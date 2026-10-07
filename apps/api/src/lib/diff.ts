import type { EquippedItem, EventData, GearChange, TalentGroup } from "@wow-locker/shared";
import { COSMETIC_SLOTS } from "@/lib/classic";
import { activeTrees } from "@/lib/normalize";

/** The parts of a snapshot that can produce events. */
export type Snapshot = {
  level: number;
  isGhost: boolean;
  isSelfFound: boolean;
  guild: string | null;
  equipment: EquippedItem[];
  talents: TalentGroup[];
};

/**
 * What happened between two snapshots, in reading order. Pure.
 *
 * - death wins over everything else (a dead Hardcore character's other
 *   "changes" are noise);
 * - a respec is points LEAVING a tree; points simply added while levelling are
 *   not an event of their own;
 * - shirt/tabard swaps are ignored; gear changes are batched into one event.
 */
export function diffSnapshots(prev: Snapshot, next: Snapshot): EventData[] {
  if (!prev.isGhost && next.isGhost) return [{ type: "death", level: next.level }];

  const out: EventData[] = [];
  if (next.level > prev.level) out.push({ type: "level", from: prev.level, to: next.level });

  const changes = gearChanges(prev.equipment, next.equipment);
  if (changes.length) out.push({ type: "gear", changes });

  const before = activeTrees(prev.talents);
  const after = activeTrees(next.talents);
  const lost = before.some((t) => (after.find((a) => a.name === t.name)?.points ?? 0) < t.points);
  if (before.length && lost) out.push({ type: "respec", from: before, to: after });

  if ((prev.guild ?? null) !== (next.guild ?? null)) out.push({ type: "guild", from: prev.guild, to: next.guild });
  if (prev.isSelfFound && !next.isSelfFound) out.push({ type: "selfFoundLost" });
  return out;
}

export function gearChanges(prev: EquippedItem[], next: EquippedItem[]): GearChange[] {
  const bySlot = (items: EquippedItem[]) => new Map(items.map((i) => [i.slot, i]));
  const a = bySlot(prev);
  const b = bySlot(next);
  const slots = [...new Set([...a.keys(), ...b.keys()])].filter((s) => !COSMETIC_SLOTS.has(s));
  const out: GearChange[] = [];
  for (const slot of slots) {
    const x = a.get(slot);
    const y = b.get(slot);
    if (x?.itemId === y?.itemId) continue;
    out.push({
      slot,
      slotName: (y ?? x)!.slotName,
      from: x?.name ?? null,
      to: y?.name ?? null,
      quality: y?.quality ?? null,
    });
  }
  return out;
}

/**
 * Profile availability, as a small state machine. Blizzard occasionally 404s a
 * character that exists, so "missing" is only reported on the second "not
 * found" in a row, and "found" only for a character we had reported missing.
 */
export type Availability = { status: "ok" | "not_found" | "error"; missingReported: boolean };

export function availabilityStep(
  prev: Availability,
  answer: "ok" | "not_found" | "error",
): { next: Availability; event: EventData | null } {
  if (answer === "error") return { next: prev, event: null }; // transient: change nothing
  if (answer === "ok") {
    return {
      next: { status: "ok", missingReported: false },
      event: prev.missingReported ? { type: "found" } : null,
    };
  }
  if (prev.status === "not_found" && !prev.missingReported) {
    return { next: { status: "not_found", missingReported: true }, event: { type: "missing" } };
  }
  return { next: { status: "not_found", missingReported: prev.missingReported }, event: null };
}

/**
 * A character the account no longer has (deleted): Battle.net's list at
 * pairing left it out though the addon had already seen it, every flavour
 * having answered; or, tracked since, Battle.net has lost it (reported
 * missing). The companion then leaves it out of its list. Played again, it
 * was never gone: seen after the list, it is only not linked ("unknown").
 */
export function isGone(
  link: { createdAt: Date; unavailable: readonly string[] | null },
  owned: boolean,
  lastSeen: string | null,
  missingReported: boolean,
): boolean {
  if (owned) return missingReported;
  if (link.unavailable && link.unavailable.length > 0) return false; // a flavour unheard: can't tell
  return lastSeen != null && new Date(lastSeen) < link.createdAt;
}
