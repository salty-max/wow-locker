import type { BagItem, CharacterDetail, Container, Flavour, ItemMatch, Quality, Region } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemTooltip } from "@/components/ItemTooltip";
import { When } from "@/components/When";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useRoster } from "@/lib/roster";
import { createStore } from "@/lib/store";
import { useTooltip } from "@/lib/useTooltip";

/**
 * The bags and the bank, drawn like the game's bag windows (one per bag, a
 * grid of slots with the stack count in the corner), plus a search across
 * every character of this device's locker. Data as of the addon's last save;
 * the bank as of the last visit (it's only readable while open in game).
 */

const QUALITIES = ["poor", "common", "uncommon", "rare", "epic", "legendary", "artifact", "heirloom"];
const qualityName = (q: number | null) => (q == null ? "common" : (QUALITIES[q] ?? "common"));

type Realm = { region: Region; flavour: Flavour };

/**
 * The game's tooltip for an item in bags or the bank. Its details come from
 * Battle.net's item data, fetched (once, then cached) when it's first hovered.
 */
function BagItemTip({ itemId, name, quality, count, realm }: { itemId: number; name: string; quality: number | null; count: number; realm: Realm }) {
  const t = useT();
  const q = useQuery({
    queryKey: ["tooltip", realm.region, realm.flavour, itemId],
    queryFn: () => api.itemTooltip(realm.region, realm.flavour, itemId),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return (
    <div className="space-y-0.5">
      <ItemTooltip
        item={{
          slot: "",
          slotName: "",
          itemId,
          name,
          quality: qualityName(quality) as Quality,
          iconUrl: null,
          enchantments: [],
          tooltip: q.data ?? undefined,
        }}
      />
      {q.isPending && <p className="text-xs text-ink-faint">…</p>}
      {count > 1 && <p className="text-ink-dim">{t.bags.stack(count)}</p>}
    </div>
  );
}

function Slot({ item, icon, realm }: { item: BagItem | undefined; icon: string | null | undefined; realm: Realm }) {
  const tip = useTooltip(() =>
    item ? <BagItemTip itemId={item.itemId} name={item.name} quality={item.quality} count={item.count} realm={realm} /> : null,
  );
  // Every slot is the game's bag slot (cut out of the bag window texture); an
  // item's icon fills it, as in game.
  if (!item) return <img src="/slots/bag-empty.png" alt="" aria-hidden className="size-10" />;
  const q = qualityName(item.quality);
  return (
    <button
      {...tip.anchor}
      type="button"
      aria-label={`${item.name}${item.count > 1 ? ` ×${item.count}` : ""}`}
      className="relative size-10 rounded-[4px] bg-[url(/slots/bag-empty.png)] bg-cover outline-none focus-visible:ring-2 focus-visible:ring-parchment/70"
    >
      {icon ? (
        <img src={icon} alt="" loading="lazy" className="absolute inset-px size-[calc(100%-2px)] rounded-[3px]" />
      ) : (
        <span className="q absolute inset-0 flex items-center justify-center p-0.5 text-center text-[9px] leading-tight" data-q={q}>
          {item.name.slice(0, 12)}
        </span>
      )}
      {/* A thin ring in the quality colour (grey for poor and common), so the icon's edge never looks cut. */}
      <span className="qb pointer-events-none absolute inset-0 rounded-[4px] border" data-q={q} />
      {item.count > 1 && (
        <span className="absolute right-0.5 bottom-0 text-[11px] font-bold text-white tabular-nums [text-shadow:0_0_2px_#000,0_1px_1px_#000]">
          {item.count}
        </span>
      )}
      {tip.node}
    </button>
  );
}

function BagWindow({ box, icons, realm }: { box: Container; icons: CharacterDetail["itemIcons"]; realm: Realm }) {
  const bySlot = new Map(box.items.map((i) => [i.slot, i]));
  return (
    <div className="rounded border border-[#3a3a3a] bg-black/40 p-2 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-[#ffd100] [text-shadow:0_1px_1px_#000]">{box.name ?? "?"}</span>
        <span className="shrink-0 text-ink-faint tabular-nums">
          {box.items.length}/{box.size}
        </span>
      </p>
      {/* Classic bag windows are four slots wide. */}
      <div className="grid w-max grid-cols-4 gap-1">
        {Array.from({ length: box.size }, (_, i) => {
          const item = bySlot.get(i + 1);
          return <Slot key={i} item={item} icon={item ? icons[item.itemId] : undefined} realm={realm} />;
        })}
      </div>
    </div>
  );
}

/** All of a set of bags in one window, in bag order (like Bagnon's combined view). */
function CombinedWindow({
  title,
  boxes,
  icons,
  realm,
}: {
  title: string;
  boxes: Container[];
  icons: CharacterDetail["itemIcons"];
  realm: Realm;
}) {
  const [used, total] = usedOf(boxes);
  return (
    <div className="rounded border border-[#3a3a3a] bg-black/40 p-2 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-[#ffd100] [text-shadow:0_1px_1px_#000]">{title}</span>
        <span className="shrink-0 text-ink-faint tabular-nums">
          {used}/{total}
        </span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,2.5rem)] gap-1">
        {boxes.flatMap((box) => {
          const bySlot = new Map(box.items.map((i) => [i.slot, i]));
          return Array.from({ length: box.size }, (_, i) => {
            const item = bySlot.get(i + 1);
            return <Slot key={`${box.bag}:${i}`} item={item} icon={item ? icons[item.itemId] : undefined} realm={realm} />;
          });
        })}
      </div>
    </div>
  );
}

// Separate bag windows or one combined window: remembered on this device.
const bagView = createStore<{ combined: boolean }>("wow-locker:bags-view", { combined: false });

function ViewSwitch() {
  const t = useT();
  const { combined } = bagView.use();
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={combined === value}
      onClick={() => bagView.set({ combined: value })}
      className={combined === value ? "wow-btn wow-btn-sm" : "wow-btn wow-btn-sm wow-btn-dark"}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1" role="group" aria-label={t.bags.view}>
      {option(false, t.bags.separate)}
      {option(true, t.bags.combined)}
    </div>
  );
}

function usedOf(boxes: Container[]): [number, number] {
  return boxes.reduce<[number, number]>((n, b) => [n[0] + b.items.length, n[1] + b.size], [0, 0]);
}

export function BagsFrame({ c }: { c: CharacterDetail }) {
  const t = useT();
  const { combined } = bagView.use();
  const a = c.addon;
  if (!a || (!a.bags.length && !a.bank)) return null;
  const [used, total] = usedOf(a.bags);
  const windows = (boxes: Container[], title: string) =>
    combined ? (
      <CombinedWindow title={title} boxes={boxes} icons={c.itemIcons} realm={c} />
    ) : (
      <div className="flex flex-wrap gap-2">
        {boxes.map((b) => (
          <BagWindow key={b.bag} box={b} icons={c.itemIcons} realm={c} />
        ))}
      </div>
    );
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <h2 className="wow-title">{t.bags.title}</h2>
      <ItemSearch current={c.id} />
      {a.bags.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-faint">{t.bags.used(used, total)}</p>
            <ViewSwitch />
          </div>
          {windows(a.bags, t.bags.title)}
        </>
      )}
      {a.bank && (
        <div className="mt-5">
          <p className="wow-header mb-1 text-xs">{t.bags.bank}</p>
          <p className="mb-2 text-xs text-ink-faint">
            {t.bags.used(...usedOf(a.bank.containers))} · {t.bags.lastVisit} <When iso={a.bank.at} />
          </p>
          {windows(a.bank.containers, t.bags.bank)}
        </div>
      )}
      {!a.bank && a.bags.length > 0 && <p className="mt-3 text-xs text-ink-faint">{t.bags.noBank}</p>}
    </section>
  );
}

/** A search result's icon, with the item's tooltip (realm from its character). */
function ResultIcon({ match, realm }: { match: ItemMatch; realm: Realm | undefined }) {
  const tip = useTooltip(() =>
    realm ? <BagItemTip itemId={match.itemId} name={match.name} quality={match.quality} count={1} realm={realm} /> : null,
  );
  return (
    <button {...tip.anchor} type="button" aria-label={match.name} className="wow-slot !size-8 shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-parchment/70">
      {match.icon && <img src={match.icon} alt="" loading="lazy" className="size-full" />}
      {tip.node}
    </button>
  );
}

/** Search an item across every character of this device's locker (and the one shown). */
function ItemSearch({ current }: { current: number }) {
  const t = useT();
  const { ids: roster } = useRoster();
  const ids = roster.includes(current) ? roster : [current, ...roster];
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const results = useQuery({
    queryKey: ["items", ids, debounced],
    queryFn: () => api.items(ids, debounced),
    enabled: debounced.length >= 2 && ids.length > 0,
  });
  const names = useQuery({ queryKey: ["characters", ids], queryFn: () => api.characters(ids), enabled: ids.length > 0 });
  const nameOf = new Map((names.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="mb-4">
      <label className="flex items-center gap-2 rounded border border-[#4a4a4a] bg-black/60 px-2.5 py-1.5 focus-within:border-[#8a7330]">
        <Search className="size-4 shrink-0 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.bags.search}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          aria-label={t.bags.search}
        />
      </label>
      {debounced.length >= 2 && results.data && (
        <div className="mt-2">
          {results.data.length === 0 ? (
            <p className="text-sm text-ink-dim">{t.bags.noMatch}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.data.map((m) => {
                const who = nameOf.get(m.characterId);
                const where = (
                  [
                    ["bags", m.bags],
                    ["bank", m.bank],
                    ["mail", m.mail],
                    ["equipped", m.equipped],
                  ] as const
                ).filter(([, n]) => n > 0);
                return (
                  <li key={`${m.characterId}:${m.itemId}`} className="flex items-center gap-2.5 rounded bg-black/30 px-2 py-1">
                    <ResultIcon match={m} realm={who} />
                    <span className="min-w-0 flex-1">
                      <span className="q block truncate text-sm" data-q={qualityName(m.quality)}>
                        {m.name}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {where.map(([k, n]) => t.bags.where[k](n)).join(" · ")}
                      </span>
                    </span>
                    {who && (
                      <Link
                        to="/character/$id"
                        params={{ id: String(m.characterId) }}
                        className="cc shrink-0 text-sm hover:underline"
                        data-c={who.classKey ?? undefined}
                      >
                        {who.name}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
