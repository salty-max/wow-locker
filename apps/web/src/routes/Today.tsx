import type { CharacterSummary } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Skull } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Money } from "@/components/Money";
import { StatBox } from "@/components/StatBox";
import { When } from "@/components/When";
import { played } from "@/lib/addonView";
import { api } from "@/lib/api";
import { LoadError, PageSkeleton } from "@/components/PageState";
import { useLang, useT } from "@/lib/i18n";
import { useTitle } from "@/lib/useTitle";
import { useRoster } from "@/lib/roster";
import { restedShare, todayView, type TodayItem } from "@/lib/todayView";
import { cn } from "@/lib/utils";

/**
 * Today: every character's chores in one place, from their last addon save —
 * crafts off cooldown, fully rested characters, new and expiring mail — then
 * what comes up this week, and each character's rest, bags, gold and mail.
 */

const coins = (copper: number) => ({
  gold: Math.floor(copper / 10000),
  silver: Math.floor(copper / 100) % 100,
  copper: copper % 100,
});

function Avatar({ c, size = "size-7" }: { c: CharacterSummary; size?: string }) {
  return c.avatarUrl ? (
    <img src={c.avatarUrl} alt="" className={cn(size, "shrink-0 rounded-full border border-[#8a7330] object-cover", c.isGhost && "grayscale")} />
  ) : (
    <span className={cn(size, "block shrink-0 rounded-full border border-[#8a7330] bg-stone-3")} />
  );
}

function ItemRow({ item, c }: { item: TodayItem; c: CharacterSummary }) {
  const t = useT();
  const T = t.today;
  const text =
    item.kind === "cooldown"
      ? item.at
        ? T.cooldownAt(item.detail ?? "?")
        : T.cooldownReady(item.detail ?? "?")
      : item.kind === "rested"
        ? item.at
          ? T.restedFull
          : T.fullyRested
        : item.kind === "newMail"
          ? T.newMail
          : T.mailExpires(item.count ?? 1, item.returned ?? false);
  return (
    <li>
      <Link
        to="/character/$id"
        params={{ id: String(c.id) }}
        className="wow-row flex items-center gap-2.5 px-2 py-1.5 text-sm"
      >
        <Avatar c={c} />
        <span className="min-w-0 flex-1">
          <span className="cc block truncate text-xs font-semibold" data-c={c.classKey ?? undefined}>
            {c.name}
          </span>
          <span className={cn("block truncate", item.urgent ? "font-semibold text-q-danger" : "text-white")}>{text}</span>
        </span>
        {item.at && (
          <span className={cn("shrink-0 text-xs", item.urgent ? "text-q-danger" : "text-ink-dim")}>
            <When iso={item.at} />
          </span>
        )}
      </Link>
    </li>
  );
}

function List({ title, items, empty, byId }: { title: string; items: TodayItem[]; empty: string; byId: Map<number, CharacterSummary> }) {
  return (
    <div className="min-w-0">
      <p className="wow-header mb-1.5 text-xs">{title}</p>
      {items.length === 0 ? (
        <p className="px-2 text-sm text-ink-faint">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <ItemRow key={i} item={it} c={byId.get(it.characterId)!} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RestedBar({ share }: { share: number }) {
  // 150% of a level is the cap: a full bar.
  return (
    <span className="relative block h-2 w-14 overflow-hidden rounded-sm border border-black bg-black/60" title={`${Math.round(share * 100)}%`}>
      <span className="absolute inset-y-0 left-0 bg-[#3d64c8]" style={{ width: `${Math.min(100, (share / 1.5) * 100)}%` }} />
    </span>
  );
}

function CharactersTable({ list }: { list: CharacterSummary[] }) {
  const t = useT();
  const T = t.today;
  const cell = "py-1.5 pl-3 text-right whitespace-nowrap tabular-nums";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] text-ink-faint">
          <th className="pb-1 font-normal">
            <span className="sr-only">{T.character}</span>
          </th>
          <th className="pb-1 pl-3 text-right font-normal">{T.rested}</th>
          <th className="pb-1 pl-3 text-right font-normal">{T.bags}</th>
          <th className="hidden pb-1 pl-3 text-right font-normal sm:table-cell">{T.gold}</th>
          <th className="pb-1 pl-3 text-right font-normal">{T.mail}</th>
          <th className="hidden pb-1 pl-3 text-right font-normal sm:table-cell">{T.saved}</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => {
          const d = c.today;
          const share = restedShare(c);
          const full = d?.bags ? d.bags.used / d.bags.total >= 0.9 : false;
          return (
            <tr key={c.id} className="border-t border-white/5">
              <td className="w-full max-w-0 py-1.5">
                <Link to="/character/$id" params={{ id: String(c.id) }} className="flex min-w-0 items-center gap-2 hover:brightness-125">
                  <Avatar c={c} />
                  <span className={cn("truncate font-semibold", c.isGhost ? "text-q-poor" : "cc")} data-c={c.classKey ?? undefined}>
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {T.level} {c.level}
                  </span>
                </Link>
              </td>
              <td className={cell}>{share != null ? <span className="inline-flex justify-end"><RestedBar share={share} /></span> : "—"}</td>
              <td className={cn(cell, full && "text-q-danger")}>{d?.bags ? `${d.bags.used}/${d.bags.total}` : "—"}</td>
              <td className={cn(cell, "hidden sm:table-cell")}>{d?.money ? <Money {...coins(d.money)} /> : "—"}</td>
              <td className={cell}>
                {d?.mail ? (
                  <span className={cn(d.mail.hasNew && "font-semibold text-[#ffd100]")}>
                    {d.mail.hasNew && "✉ "}
                    {d.mail.letters}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={cn(cell, "hidden text-xs text-ink-dim sm:table-cell")}>{d?.savedAt ? <When iso={d.savedAt} /> : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Today() {
  const t = useT();
  useTitle(t.today.title);
  const lang = useLang();
  const T = t.today;
  const { ids } = useRoster();
  // The roster query, shared with the locker (same key).
  const q = useQuery({ queryKey: ["characters", ids], queryFn: () => api.characters(ids), enabled: ids.length > 0, refetchInterval: 60_000 });
  const list = useMemo(() => {
    const byId = new Map((q.data ?? []).map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter((c) => c != null);
  }, [q.data, ids]);
  const byId = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);
  const v = todayView(list);

  const memorialLink = (
    <Link to="/memorial" className="wow-btn wow-btn-dark wow-btn-sm">
      <Skull className="size-3.5" /> {T.memorial}
    </Link>
  );

  if (ids.length === 0 || (q.data && v.tracked === 0)) {
    return (
      <div className="wow-frame mx-auto mt-6 flex max-w-md flex-col items-center gap-4 px-6 pt-10 pb-7 text-center">
        <h1 className="wow-title">{T.title}</h1>
        <p className="text-sm text-ink-dim">{ids.length === 0 ? t.locker.empty : T.noAddon}</p>
        <Link to={ids.length === 0 ? "/" : "/addon"} className="wow-btn">
          {ids.length === 0 ? t.locker.add : T.getAddon}
        </Link>
        {list.some((c) => c.isGhost) && memorialLink}
      </div>
    );
  }
  if (!q.data) return q.isError ? <LoadError onRetry={() => void q.refetch()} /> : <PageSkeleton />;

  const totals: [string, ReactNode][] = [];
  if (v.gold != null) totals.push([T.gold, <Money {...coins(v.gold)} />]);
  if (v.played != null) totals.push([T.played, played(v.played, lang)]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex justify-end">{memorialLink}</div>
      <section className="wow-frame px-3 pt-8 pb-4 sm:px-5">
        <h1 className="wow-title">{T.title}</h1>
        <div className="grid gap-5 md:grid-cols-2">
          <List title={T.needsYou} items={v.needsYou} empty={T.nothingNow} byId={byId} />
          <List title={T.upcoming} items={v.upcoming} empty={T.nothingSoon} byId={byId} />
        </div>
        {totals.length > 0 && (
          <div className="mt-5">
            <StatBox title={T.allCharacters} rows={totals} />
          </div>
        )}
      </section>
      <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
        <h2 className="wow-title">{T.characters}</h2>
        <CharactersTable list={list} />
      </section>
    </div>
  );
}
