import type { CharacterDetail, LearnedTalent } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTooltip } from "@/lib/useTooltip";
import { useT } from "@/lib/i18n";
import { iconUrl, loadTalentTrees, type TalentDef, type TreeDef } from "@/lib/talentData";
import { cn } from "@/lib/utils";

// Grid geometry (px): icon cells and gaps, shared by the cells and the arrows.
const CELL = 40;
const GAP = 12;
const STEP = CELL + GAP;

type Props = { c: CharacterDetail & { flavour: "classic1x" | "classicann" } };

/** The class's three real talent trees, with the character's points in them. */
export function TalentTrees({ c }: Props) {
  const t = useT();
  const data = useQuery({ queryKey: ["talent-trees", c.flavour], queryFn: () => loadTalentTrees(c.flavour), staleTime: Infinity });
  const trees = c.classKey ? data.data?.[c.classKey] : undefined;

  // Learned talents by id (profile trees are named like the game's tabs).
  const group = c.talents.find((g) => g.active) ?? c.talents[0];
  const learned = useMemo(() => {
    const m = new Map<number, LearnedTalent>();
    for (const tree of group?.trees ?? []) for (const x of tree.talents ?? []) m.set(x.id, x);
    return m;
  }, [group]);
  const pointsIn = (tree: TreeDef) => tree.talents.reduce((n, x) => n + (learned.get(x.id)?.rank ?? 0), 0);

  // On phones one tree at a time: start on the one with the most points.
  const [tab, setTab] = useState<number | null>(null);
  if (!trees) return <div className={cn("h-64 rounded-lg bg-stone-2/50", data.isPending && "animate-pulse")} />;
  const defaultTab = trees.reduce((best, tree, i) => (pointsIn(tree) > pointsIn(trees[best]) ? i : best), 0);
  const current = tab ?? defaultTab;

  return (
    <div>
      <p className="mb-3 font-display text-lg tabular-nums">{trees.map(pointsIn).join(" / ")}</p>
      <div className="mb-3 flex gap-1.5 md:hidden" role="tablist">
        {trees.map((tree, i) => (
          <button
            key={tree.name}
            role="tab"
            aria-selected={current === i}
            onClick={() => setTab(i)}
            className={cn("wow-btn wow-btn-sm flex-1 px-1", current !== i && "wow-btn-dark")}
          >
            {tree.name} <span className="tabular-nums opacity-70">{pointsIn(tree)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {trees.map((tree, i) => (
          <div key={tree.name} className={cn(current !== i && "hidden md:block")}>
            <Tree tree={tree} learned={learned} points={pointsIn(tree)} c={c} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">{t.character.talentHint}</p>
    </div>
  );
}

function Tree({ tree, learned, points, c }: { tree: TreeDef; learned: Map<number, LearnedTalent>; points: number; c: Props["c"] }) {
  const tiers = Math.max(...tree.talents.map((x) => x.tier)) + 1;
  const byId = new Map(tree.talents.map((x) => [x.id, x]));
  const width = 4 * CELL + 3 * GAP;
  const height = tiers * CELL + (tiers - 1) * GAP;

  return (
    <div className="rounded border border-[#3a3a3a] bg-black/50 p-3 shadow-[inset_0_1px_6px_rgb(0_0_0/0.9)]">
      <div className="mb-3 flex items-center gap-2">
        {tree.icon && <img src={iconUrl(c.flavour, c.region, tree.icon)!} alt="" className="size-6 rounded" />}
        <span className="font-display text-sm text-[#ffd100] [text-shadow:0_1px_1px_#000]">{tree.name}</span>
        <span className="ml-auto text-sm tabular-nums text-ink-dim">{points}</span>
      </div>

      <div className="relative mx-auto" style={{ width, height }}>
        {/* Prerequisite arrows, under the icons. */}
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
          {tree.talents
            .filter((x) => x.req && byId.has(x.req))
            .map((x) => {
              const from = byId.get(x.req!)!;
              const lit = (learned.get(from.id)?.rank ?? 0) >= from.max;
              const cx = (n: number) => n * STEP + CELL / 2;
              const cy = (n: number) => n * STEP + CELL / 2;
              const horizontal = from.tier === x.tier;
              const x1 = horizontal ? from.col * STEP + (from.col < x.col ? CELL : 0) : cx(from.col);
              const y1 = horizontal ? cy(from.tier) : from.tier * STEP + CELL;
              const x2 = horizontal ? x.col * STEP + (from.col < x.col ? 0 : CELL) : cx(x.col);
              const y2 = horizontal ? cy(x.tier) : x.tier * STEP;
              return (
                <line
                  key={x.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2 - (horizontal ? 0 : 2)}
                  stroke={lit ? "#f8b700" : "#4a4f5c"}
                  strokeWidth={3}
                  markerEnd={`url(#arrow-${lit ? "lit" : "dim"})`}
                />
              );
            })}
          <defs>
            {(["lit", "dim"] as const).map((k) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill={k === "lit" ? "#f8b700" : "#4a4f5c"} />
              </marker>
            ))}
          </defs>
        </svg>

        {tree.talents.map((x) => (
          <TalentCell key={x.id} x={x} tree={tree} points={points} learned={learned} byId={byId} c={c} />
        ))}
      </div>

    </div>
  );
}

function TalentCell({
  x,
  tree,
  points,
  learned,
  byId,
  c,
}: {
  x: TalentDef;
  tree: TreeDef;
  points: number;
  learned: Map<number, LearnedTalent>;
  byId: Map<number, TalentDef>;
  c: Props["c"];
}) {
  const t = useT();
  const info = learned.get(x.id);
  const rank = info?.rank ?? 0;
  const maxed = rank >= x.max;
  const locked = points < x.tier * 5;
  const req = x.req ? byId.get(x.req) : undefined;
  const reqMissing = req && (learned.get(req.id)?.rank ?? 0) < req.max;
  const tip = useTooltip(() => (
    <div className="space-y-1">
      <p className="text-[14px] font-semibold">{x.name}</p>
      <p className={maxed ? "text-gold" : "text-ink-dim"}>{t.tooltip.rank(rank, x.max)}</p>
      {locked && <p className="text-q-danger">{t.tooltip.requiresPoints(x.tier * 5, tree.name)}</p>}
      {reqMissing && <p className="text-q-danger">{t.tooltip.requiresTalent(req.max, req.name)}</p>}
      {/* WoW prints talent descriptions in its tooltip gold. */}
      {info?.description ? <p className="text-[#ffd100]">{info.description}</p> : <p className="text-xs text-ink-faint">{t.tooltip.notLearned}</p>}
    </div>
  ));
  return (
    <button
      {...tip.anchor}
      type="button"
      aria-label={`${x.name} ${rank}/${x.max}`}
      className={cn(
        "absolute rounded-md border-2 transition outline-none focus-visible:ring-2 focus-visible:ring-parchment/70",
        rank > 0 ? (maxed ? "border-gold" : "border-q-uncommon") : "border-edge",
      )}
      style={{ left: x.col * STEP, top: x.tier * STEP, width: CELL, height: CELL }}
    >
      {x.icon ? (
        <img
          src={iconUrl(c.flavour, c.region, x.icon)!}
          alt=""
          loading="lazy"
          className={cn("size-full rounded", rank === 0 && (locked ? "opacity-25 grayscale" : "opacity-50 grayscale"))}
        />
      ) : (
        <span className="block size-full rounded bg-stone-3" />
      )}
      {(rank > 0 || !locked) && (
        <span
          className={cn(
            "absolute -right-2 -bottom-2 rounded border bg-night px-0.5 text-[10px] leading-tight font-bold tabular-nums",
            rank > 0 ? (maxed ? "border-gold text-gold" : "border-q-uncommon text-q-uncommon") : "border-edge text-ink-faint",
          )}
        >
          {rank}/{x.max}
        </span>
      )}
      {tip.node}
    </button>
  );
}
