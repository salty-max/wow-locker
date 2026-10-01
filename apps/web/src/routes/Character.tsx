import type { CharacterDetail, EquippedItem, Stats, TalentGroup } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Circle,
  Crosshair,
  Footprints,
  Gem,
  Hand,
  HardHat,
  Shield,
  Shirt,
  Sparkles,
  Sword,
  Trash2,
  Watch,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadges } from "@/components/Badges";
import { CharacterRender } from "@/components/CharacterRender";
import { ChatLog } from "@/components/ChatLog";
import { ItemTooltip } from "@/components/ItemTooltip";
import { TalentTrees } from "@/components/TalentTrees";
import { When } from "@/components/When";
import { XpBar } from "@/components/XpBar";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { moveInRoster, removeFromRoster, useRoster } from "@/lib/roster";
import { hasTalentTrees } from "@/lib/talentData";
import { useTooltip } from "@/lib/useTooltip";
import { cn } from "@/lib/utils";
import { realmLabel } from "@/lib/wow";

const route = getRouteApi("/character/$id");

// The Classic paper doll: left column, right column, weapons under the model.
const LEFT = ["HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "SHIRT", "TABARD", "WRIST"];
const RIGHT = ["HANDS", "WAIST", "LEGS", "FEET", "FINGER_1", "FINGER_2", "TRINKET_1", "TRINKET_2"];
const BOTTOM = ["MAIN_HAND", "OFF_HAND", "RANGED"];
const SLOT_ICON: Record<string, LucideIcon> = {
  HEAD: HardHat,
  NECK: Gem,
  SHOULDER: Shield,
  BACK: Wind,
  CHEST: Shirt,
  SHIRT: Shirt,
  TABARD: Shirt,
  WRIST: Watch,
  HANDS: Hand,
  WAIST: Circle,
  LEGS: Footprints,
  FEET: Footprints,
  FINGER_1: Circle,
  FINGER_2: Circle,
  TRINKET_1: Sparkles,
  TRINKET_2: Sparkles,
  MAIN_HAND: Sword,
  OFF_HAND: Shield,
  RANGED: Crosshair,
};

function Slot({ slot, item }: { slot: string; item?: EquippedItem }) {
  const t = useT();
  const label = t.slots[slot as keyof typeof t.slots] ?? slot;
  const tip = useTooltip(() =>
    item ? <ItemTooltip item={item} /> : <p className="text-ink-dim">{label}</p>,
  );
  const Icon = SLOT_ICON[slot] ?? Circle;
  return (
    <span
      {...tip.anchor}
      tabIndex={0}
      aria-label={item ? item.name : label}
      className={cn("wow-slot outline-none focus-visible:ring-2 focus-visible:ring-[#ffd100]", item && "q qb")}
      data-q={item?.quality}
      style={item ? { boxShadow: "0 0 0 1px #000, 0 0 6px -1px currentColor" } : undefined}
    >
      {item?.iconUrl ? (
        <img src={item.iconUrl} alt="" loading="lazy" />
      ) : item ? (
        <span className="block size-full bg-stone-3" />
      ) : (
        <Icon className="absolute inset-0 m-auto size-5 text-white/15" />
      )}
      {tip.node}
    </span>
  );
}

function PaperDoll({ c }: { c: CharacterDetail }) {
  const bySlot = new Map(c.equipment.map((i) => [i.slot, i]));
  const column = (slots: string[]) => (
    <div className="flex flex-col gap-1.5">
      {slots.map((s) => (
        <Slot key={s} slot={s} item={bySlot.get(s)} />
      ))}
    </div>
  );
  return (
    <div className="flex items-start justify-center gap-2 sm:gap-4">
      {column(LEFT)}
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className={cn("relative h-[19rem] w-full max-w-64 sm:h-[22rem]", c.isGhost && "fallen")}>
          <div className="absolute inset-x-[12%] bottom-1 h-8 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgb(255_209_0/0.15),transparent_70%)]" />
          <CharacterRender url={c.renderUrl} avatarUrl={c.avatarUrl} className="h-full w-full" />
        </div>
        <div className="mt-1 flex gap-1.5">
          {BOTTOM.map((s) => (
            <Slot key={s} slot={s} item={bySlot.get(s)} />
          ))}
        </div>
      </div>
      {column(RIGHT)}
    </div>
  );
}

function StatBox({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
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

function StatPanel({ s }: { s: Stats }) {
  const t = useT();
  const L = t.character.statLabels;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <StatBox
        title={t.character.attributes}
        rows={[
          [L.strength, s.strength],
          [L.agility, s.agility],
          [L.stamina, s.stamina],
          [L.intellect, s.intellect],
          [L.spirit, s.spirit],
          [L.armor, s.armor],
        ]}
      />
      <StatBox
        title={t.character.combat}
        rows={[
          [L.health, s.health],
          [s.powerType || L.power, s.power],
          [L.attackPower, s.attackPower],
          [L.spellPower, s.spellPower],
          [L.meleeCrit, `${s.meleeCrit}%`],
          [L.spellCrit, `${s.spellCrit}%`],
          [L.dodge, `${s.dodge}%`],
        ]}
      />
    </div>
  );
}

/** Points per tree, for the flavour without a generated tree (MoP Classic). */
function TalentPoints({ groups }: { groups: TalentGroup[] }) {
  const t = useT();
  const g = groups.find((x) => x.active) ?? groups[0];
  const total = g?.trees.reduce((n, x) => n + x.points, 0) ?? 0;
  if (!g || total === 0) return <p className="text-sm text-ink-faint">{t.character.noTalents}</p>;
  return (
    <div className="space-y-2">
      {g.trees.map((tree) => (
        <div key={tree.name} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-[#ffd100]">{tree.name}</span>
          <span className="h-2 flex-1 rounded-full bg-stone-3">
            <span className="block h-full rounded-full bg-gold/80" style={{ width: `${(tree.points / Math.max(total, 1)) * 100}%` }} />
          </span>
          <span className="w-6 text-right tabular-nums">{tree.points}</span>
        </div>
      ))}
    </div>
  );
}

export function Character() {
  const t = useT();
  const router = useRouter();
  const id = Number(route.useParams().id);
  const { ids } = useRoster();
  const q = useQuery({ queryKey: ["character", id], queryFn: () => api.character(id), refetchInterval: 60_000 });
  const c = q.data;
  const inRoster = ids.includes(id);
  const idx = ids.indexOf(id);

  if (!c) return <div className={cn("wow-frame h-96", q.isPending && "animate-pulse")} />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="wow-btn wow-btn-dark wow-btn-sm mb-6">
        <ArrowLeft className="size-3.5" /> {t.character.back}
      </Link>

      <div className={cn("wow-frame px-3 pt-8 pb-4 sm:px-5", c.isGhost && "[filter:saturate(0.6)]")}>
        <span className="wow-title text-base sm:text-lg">
          <span className="cc" data-c={c.classKey ?? undefined}>
            {c.name}
          </span>
        </span>

        {/* Header: portrait + identity, like the top of the game's Character frame. */}
        <div className="flex items-center gap-3">
          <span className={cn("relative shrink-0", c.isGhost && "fallen")}>
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt=""
                className="size-16 rounded-full border-[3px] border-[#a8862f] object-cover shadow-[0_0_0_1px_#000,0_3px_8px_rgb(0_0_0/0.7)] sm:size-[4.5rem]"
              />
            ) : (
              <span className="block size-16 rounded-full border-[3px] border-[#a8862f] bg-stone-3" />
            )}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded border border-[#a8862f] bg-black px-1.5 text-xs font-bold text-[#ffd100] tabular-nums">
              {c.level}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[#ffd100] [text-shadow:0_1px_1px_#000]">
              {t.card.level(c.level)} {c.race} <span className="cc" data-c={c.classKey ?? undefined}>{c.className}</span>
            </p>
            {c.guild && <p className="text-sm text-q-uncommon">&lt;{c.guild}&gt;</p>}
            <p className="text-xs text-ink-faint">
              {c.realmName} <span className="uppercase">{c.region}</span> ·{" "}
              {(() => {
                const label = realmLabel({ region: c.region, slug: c.realmSlug, flavour: c.flavour, category: c.realmCategory });
                return <span className={cn(label === "Hardcore" && "font-semibold text-q-danger")}>{label}</span>;
              })()}
            </p>
            <div className="mt-1">
              <StatusBadges c={c} />
            </div>
          </div>
        </div>
        {!c.isGhost && c.xpToNext != null && (
          <div className="mt-3">
            <XpBar xp={c.experience} max={c.xpToNext} />
          </div>
        )}
        <p className="mt-1 text-[11px] text-ink-faint" title={t.character.freshness}>
          {c.isGhost && c.deadAt ? (
            <>
              {t.card.deadOn} <When iso={c.deadAt} />
            </>
          ) : c.lastLoginAt ? (
            <>
              {t.card.lastSeen} <When iso={c.lastLoginAt} />
            </>
          ) : null}
          {c.fetchedAt && (
            <>
              {" · "}
              {t.character.checked} <When iso={c.fetchedAt} />
            </>
          )}
        </p>

        <div className="mt-5">
          <PaperDoll c={c} />
          {c.stats && <StatPanel s={c.stats} />}
        </div>
      </div>

      <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
        <span className="wow-title">{t.character.talents}</span>
        {hasTalentTrees(c.flavour) ? <TalentTrees c={{ ...c, flavour: c.flavour }} /> : <TalentPoints groups={c.talents} />}
      </section>

      <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
        <span className="wow-title">{t.character.timeline}</span>
        <ChatLog c={c} />
      </section>

      {inRoster && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="wow-btn wow-btn-dark wow-btn-sm" disabled={idx <= 0} onClick={() => moveInRoster(id, -1)}>
            <ChevronUp className="size-3.5" /> {t.locker.moveUp}
          </button>
          <button className="wow-btn wow-btn-dark wow-btn-sm" disabled={idx >= ids.length - 1} onClick={() => moveInRoster(id, 1)}>
            <ChevronDown className="size-3.5" /> {t.locker.moveDown}
          </button>
          <button
            className="wow-btn wow-btn-sm ml-auto"
            onClick={() => {
              removeFromRoster(id);
              void router.navigate({ to: "/" });
            }}
          >
            <Trash2 className="size-3.5" /> {t.locker.remove}
          </button>
        </div>
      )}
    </div>
  );
}
