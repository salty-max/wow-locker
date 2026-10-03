import type { AddonState, TodayInfo } from "@wow-locker/shared";

/** The Today overview's slice of the last addon save. */
export function todayInfo(a: AddonState | null, now = Date.now()): TodayInfo | null {
  if (!a) return null;
  const letters = (a.mail?.letters ?? []).filter((l) => Date.parse(l.expiresAt) > now).sort((x, y) => x.expiresAt.localeCompare(y.expiresAt));
  const bags = a.bags ?? [];
  const total = bags.reduce((n, b) => n + b.size, 0);
  return {
    savedAt: a.updatedAt,
    xp: a.xp,
    xpMax: a.xpMax,
    rested: a.rested,
    resting: a.resting,
    // The very first addon version saved 0 before reading the money.
    money: a.money === 0 && a.xpMax == null ? null : a.money,
    played: a.playedTotal,
    zone: a.zone,
    bags: total > 0 ? { used: bags.reduce((n, b) => n + b.items.length, 0), total } : null,
    mail: a.mail
      ? { letters: letters.length, hasNew: a.mail.hasNew, nextExpiry: letters[0]?.expiresAt ?? null, nextOnExpiry: letters[0]?.onExpiry ?? null }
      : null,
    cooldowns: (a.cooldowns ?? []).map((c) => ({ name: c.name, readyAt: c.readyAt })),
  };
}
