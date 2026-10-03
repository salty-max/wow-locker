import type { DangerStats, EventData } from "@wow-locker/shared";

/**
 * Close calls and deaths by attacker, zone and dungeon, from a character's
 * (or a whole roster's) recorded events.
 */
const TOP = 8;

export function dangerStats(events: EventData[]): DangerStats {
  const out: DangerStats = { closeCalls: 0, deaths: 0, petDeaths: 0, lowest: null, attackers: [], zones: [], dungeons: [] };
  const attackers = new Map<string, DangerStats["attackers"][number]>();
  const zones = new Map<string, DangerStats["zones"][number]>();
  const dungeons = new Map<string, DangerStats["dungeons"][number]>();
  const attacker = (name: string) => attackers.get(name) ?? attackers.set(name, { name, closeCalls: 0, deaths: 0, lowest: null }).get(name)!;
  const zone = (name: string) => zones.get(name) ?? zones.set(name, { name, closeCalls: 0, deaths: 0 }).get(name)!;
  const dungeon = (name: string) => dungeons.get(name) ?? dungeons.set(name, { name, runs: 0, closeCalls: 0, deaths: 0 }).get(name)!;

  for (const d of events) {
    if (d.type === "closeCall") {
      out.closeCalls++;
      out.lowest = out.lowest == null ? d.pct : Math.min(out.lowest, d.pct);
      const who = d.attacker ?? d.spell;
      if (who) {
        const a = attacker(who);
        a.closeCalls++;
        a.lowest = a.lowest == null ? d.pct : Math.min(a.lowest, d.pct);
      }
      const where = d.instance ?? d.zone;
      if (where) zone(where).closeCalls++;
    } else if (d.type === "death") {
      out.deaths++;
      const who = d.killer ?? d.spell;
      if (who) attacker(who).deaths++;
      const where = d.instance ?? d.zone;
      if (where) zone(where).deaths++;
    } else if (d.type === "pet" && d.action === "death") {
      out.petDeaths++;
    } else if (d.type === "dungeon" && d.action === "leave") {
      const r = dungeon(d.name);
      r.runs++;
      r.closeCalls += d.closeCalls ?? 0;
      r.deaths += d.deaths ?? 0;
    }
  }
  const danger = (x: { closeCalls: number; deaths: number }) => x.deaths * 1000 + x.closeCalls;
  out.attackers = [...attackers.values()].sort((a, b) => danger(b) - danger(a) || (a.lowest ?? 100) - (b.lowest ?? 100) || a.name.localeCompare(b.name)).slice(0, TOP);
  out.zones = [...zones.values()].sort((a, b) => danger(b) - danger(a) || a.name.localeCompare(b.name)).slice(0, TOP);
  out.dungeons = [...dungeons.values()].sort((a, b) => b.runs - a.runs || danger(b) - danger(a) || a.name.localeCompare(b.name)).slice(0, TOP);
  return out;
}
