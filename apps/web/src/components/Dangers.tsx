import type { DangerStats } from "@wow-locker/shared";
import { StatBox } from "@/components/StatBox";
import { hasDangers } from "@/lib/dangers";
import { useT } from "@/lib/i18n";

const DEATH = "#ff2020";
const DANGER = "#ff8000";

function Table({ title, head, rows }: { title: string; head: string[]; rows: (string | number | null)[][] }) {
  if (!rows.length) return null;
  return (
    <div className="rounded border border-[#3a3a3a] bg-black/50 p-2.5 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]">
      <p className="wow-header mb-1 text-xs">{title}</p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-faint">
            <th className="w-full" />
            {head.map((h) => (
              <th key={h} className="pb-1 pl-2 text-right font-normal whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, ...cells], i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="w-full max-w-0 truncate py-0.5 text-[#ffd100] [text-shadow:0_1px_1px_#000]" title={String(name)}>
                {name}
              </td>
              {cells.map((v, j) => (
                <td key={j} className="py-0.5 pl-2 text-right tabular-nums text-white">
                  {v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Close calls and deaths by foe, place and dungeon. */
export function DangersView({ d }: { d: DangerStats }) {
  const t = useT();
  const D = t.dangers;
  const pct = (v: number | null) => (v == null ? null : `${v}%`);
  return (
    <div className="flex flex-col gap-3">
      <StatBox
        title={D.overall}
        rows={[
          [D.closeCalls, <span style={{ color: d.closeCalls ? DANGER : undefined }}>{d.closeCalls}</span>],
          [D.deaths, <span style={{ color: d.deaths ? DEATH : undefined }}>{d.deaths}</span>],
          ...(d.lowest != null ? ([[D.lowest, `${d.lowest}%`]] as [string, string][]) : []),
          ...(d.petDeaths ? ([[D.petDeaths, d.petDeaths]] as [string, number][]) : []),
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Table
          title={D.foes}
          head={[D.closeCalls, D.deaths, D.lowest]}
          rows={d.attackers.map((a) => [a.name, a.closeCalls, a.deaths, pct(a.lowest)])}
        />
        <Table title={D.places} head={[D.closeCalls, D.deaths]} rows={d.zones.map((z) => [z.name, z.closeCalls, z.deaths])} />
      </div>
      <Table title={D.dungeons} head={[D.runs, D.closeCalls, D.deaths]} rows={d.dungeons.map((r) => [r.name, r.runs, r.closeCalls, r.deaths])} />
    </div>
  );
}

/** The character page's Dangers frame (hidden until something happened). */
export function DangersFrame({ d }: { d: DangerStats | null }) {
  const t = useT();
  if (!hasDangers(d)) return null;
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{t.dangers.title}</span>
      <DangersView d={d} />
    </section>
  );
}
