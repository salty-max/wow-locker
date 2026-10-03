import type { CharacterDetail, EquippedItem, Stats, TalentGroup } from "@wow-locker/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronUp, Globe, Lock, Share2, Skull, Trash2 } from "lucide-react";
import { useState } from "react";
import { StatusBadges } from "@/components/Badges";
import { CharacterRender } from "@/components/CharacterRender";
import { AddonStatus, LevellingFrame, MailFrame, PetFrame, ReputationFrame, SkillsFrame } from "@/components/AddonPanels";
import { BagsFrame } from "@/components/Bags";
import { ChatLog } from "@/components/ChatLog";
import { DangersFrame } from "@/components/Dangers";
import { StatBox } from "@/components/StatBox";
import { ItemTooltip } from "@/components/ItemTooltip";
import { TalentTrees } from "@/components/TalentTrees";
import { When } from "@/components/When";
import { XpBar } from "@/components/XpBar";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { moveInRoster, removeFromRoster, useRoster } from "@/lib/roster";
import { hasTalentTrees } from "@/lib/talentData";
import { toast } from "@/lib/toast";
import { useTooltip } from "@/lib/useTooltip";
import { xpView } from "@/lib/addonView";
import { cn } from "@/lib/utils";
import { realmLabel } from "@/lib/wow";

const route = getRouteApi("/character/$id");

// The Classic paper doll: left column, right column, weapons under the model.
const LEFT = ["HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "SHIRT", "TABARD", "WRIST"];
const RIGHT = ["HANDS", "WAIST", "LEGS", "FEET", "FINGER_1", "FINGER_2", "TRINKET_1", "TRINKET_2"];
const BOTTOM = ["MAIN_HAND", "OFF_HAND", "RANGED"];
/**
 * The game's empty-slot textures (Interface/PaperDoll/UI-PaperDoll-Slot-*,
 * converted by scripts/paperdoll-slots.py). As in the game's own interface,
 * the back slot reuses the chest texture and the second ring has its own.
 */
const SLOT_TEXTURE: Record<string, string> = {
  HEAD: "head",
  NECK: "neck",
  SHOULDER: "shoulder",
  BACK: "chest",
  CHEST: "chest",
  SHIRT: "shirt",
  TABARD: "tabard",
  WRIST: "wrists",
  HANDS: "hands",
  WAIST: "waist",
  LEGS: "legs",
  FEET: "feet",
  FINGER_1: "finger",
  FINGER_2: "rfinger",
  TRINKET_1: "trinket",
  TRINKET_2: "trinket",
  MAIN_HAND: "mainhand",
  OFF_HAND: "secondaryhand",
  RANGED: "ranged",
  AMMO: "ammo",
};
// Paladins, druids and shamans carry a relic (libram, idol, totem) there.
const RELIC_CLASSES = new Set(["paladin", "druid", "shaman"]);

function Slot({ slot, item, relic = false, small = false }: { slot: string; item?: EquippedItem; relic?: boolean; small?: boolean }) {
  const t = useT();
  const label = t.slots[slot as keyof typeof t.slots] ?? slot;
  const tip = useTooltip(() =>
    item ? <ItemTooltip item={item} /> : <p className="text-ink-dim">{label}</p>,
  );
  const texture = slot === "RANGED" && relic ? "relic" : (SLOT_TEXTURE[slot] ?? "bag");
  // The slot is the game's texture (its own bevelled frame); an equipped
  // item's icon fills it, as in game, inside a thin ring in its quality colour
  // (grey for poor and common: without it the icon's edge looks cut).
  return (
    <span
      {...tip.anchor}
      tabIndex={0}
      aria-label={item ? item.name : label}
      className={cn(
        "relative block shrink-0 rounded-[4px] bg-cover outline-none focus-visible:ring-2 focus-visible:ring-[#ffd100]",
        small ? "size-8" : "size-[42px]",
      )}
      style={{ backgroundImage: `url(/slots/${texture}.png)` }}
    >
      {item &&
        (item.iconUrl ? (
          <img src={item.iconUrl} alt="" loading="lazy" className="absolute inset-px size-[calc(100%-2px)] rounded-[3px]" />
        ) : (
          <span className="absolute inset-px rounded-[3px] bg-stone-3" />
        ))}
      {item && <span className="qb pointer-events-none absolute inset-0 rounded-[4px] border" data-q={item.quality} />}
      {tip.node}
    </span>
  );
}

function PaperDoll({ c }: { c: CharacterDetail }) {
  const bySlot = new Map(c.equipment.map((i) => [i.slot, i]));
  const relic = RELIC_CLASSES.has(c.classKey ?? "");
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
        <div className="mt-1 flex items-center gap-1.5">
          {BOTTOM.map((s) => (
            <Slot key={s} slot={s} item={bySlot.get(s)} relic={relic} />
          ))}
          {/* As in game: classes without a relic slot get a small ammo slot. */}
          {!relic && <Slot slot="AMMO" item={bySlot.get("AMMO")} small />}
        </div>
      </div>
      {column(RIGHT)}
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

/**
 * Share the page: the system share sheet where there is one (phones), else the
 * link copied. Chats show a preview (OpenGraph, served to their crawlers).
 */
function ShareButton({ c }: { c: CharacterDetail }) {
  const t = useT();
  const share = async () => {
    const url = `${location.origin}/character/${c.id}`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: t.share.text(c.name), url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t.share.copied, body: t.share.copiedHint }, 4000);
    } catch {
      window.prompt(t.share.share, url);
    }
  };
  return (
    <button type="button" className="wow-btn wow-btn-dark wow-btn-sm" onClick={() => void share()}>
      <Share2 className="size-3.5" /> {t.share.share}
    </button>
  );
}

/** The owner's switch: private details (bags, mail, gold, position) for them only, or for anyone with the link. */
function SharingToggle({ c }: { c: CharacterDetail }) {
  const t = useT();
  const S = t.sharing;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.setSharing(c.id, !c.shared);
      await qc.invalidateQueries({ queryKey: ["character", c.id] });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      className={cn("wow-btn wow-btn-sm", !c.shared && "wow-btn-dark")}
      aria-pressed={c.shared}
      title={c.shared ? S.sharedHint : S.privateHint}
      disabled={busy}
      onClick={() => void toggle()}
    >
      {c.shared ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />} {c.shared ? S.shared : S.private}
    </button>
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
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/" className="wow-btn wow-btn-dark wow-btn-sm">
          <ArrowLeft className="size-3.5" /> {t.character.back}
        </Link>
        <span className="ml-auto" />
        {c.isGhost && (
          <Link to="/memorial" className="wow-btn wow-btn-dark wow-btn-sm">
            <Skull className="size-3.5" /> {t.today.memorial}
          </Link>
        )}
        {c.mine && <SharingToggle c={c} />}
        <ShareButton c={c} />
      </div>

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
        {!c.isGhost &&
          (() => {
            // The addon's XP (with rested) when it's as recent as Battle.net's.
            const v = xpView(c);
            return v ? (
              <div className="mt-3">
                <XpBar xp={v.xp} max={v.max} rested={v.rested} />
              </div>
            ) : null;
          })()}
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
          <AddonStatus c={c} />
          {c.restricted && c.addon && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Lock className="size-3.5 shrink-0" /> {t.sharing.restricted}
            </p>
          )}
        </div>
      </div>

      <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
        <span className="wow-title">{t.character.talents}</span>
        {hasTalentTrees(c.flavour) ? <TalentTrees c={{ ...c, flavour: c.flavour }} /> : <TalentPoints groups={c.talents} />}
      </section>

      {c.addon && (
        <>
          <div className="grid items-start gap-x-6 md:grid-cols-2">
            <SkillsFrame a={c.addon} />
            <ReputationFrame a={c.addon} />
          </div>
          <PetFrame c={c} />
          <BagsFrame c={c} />
          <MailFrame a={c.addon} />
          <LevellingFrame a={c.addon} />
          <DangersFrame d={c.dangers} />
        </>
      )}

      <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
        <span className="wow-title">{t.character.timeline}</span>
        <ChatLog c={c} />
        {!c.addon && (
          <p className="mt-3 text-xs text-ink-faint">
            {t.character.addonHint}{" "}
            <Link to="/addon" className="text-[#ffd100] underline-offset-2 hover:underline">
              {t.character.addonLink}
            </Link>
          </p>
        )}
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
