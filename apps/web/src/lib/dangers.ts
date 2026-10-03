import type { DangerStats } from "@wow-locker/shared";

/** Anything worth showing: a close call, a death or a finished dungeon run. */
export const hasDangers = (d: DangerStats | null | undefined): d is DangerStats =>
  d != null && d.closeCalls + d.deaths + d.petDeaths + d.dungeons.length > 0;
