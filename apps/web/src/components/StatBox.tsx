import type { ReactNode } from "react";

/** An inset box of gold label / white value rows, like the game's stat panes. */
export function StatBox({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div className="rounded border border-[#3a3a3a] bg-black/50 p-2.5 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]">
      <p className="wow-header mb-1.5 text-xs">{title}</p>
      <dl className="space-y-0.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-[#ffd100] [text-shadow:0_1px_1px_#000]">{k}</dt>
            <dd className="tabular-nums text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
