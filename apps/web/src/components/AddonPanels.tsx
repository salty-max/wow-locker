import type { AddonState, CharacterDetail } from "@wow-locker/shared";
import { MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MapPopup } from "@/components/MapPopup";
import { mapFor, type MapMarker } from "@/lib/maps";
import petIcons from "@/data/petIcons.json";
import { iconUrl } from "@/lib/talentData";
import { fullDate } from "@/lib/time";
import { XpBar } from "@/components/XpBar";
import { Money } from "@/components/Money";
import { StatBox } from "@/components/StatBox";
import { When } from "@/components/When";
import {
  knownMoney,
  levelling,
  played,
  restedNow,
  skillSections,
  sortedReputations,
  standing,
  xpView,
} from "@/lib/addonView";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * What the in-game addon adds to the character page: the in-game status box,
 * skills, reputation, mailbox + crafting cooldowns and levelling pace, each in
 * the look of the game's own panes. Every panel hides when its data is absent.
 */

const coins = (copper: number) => ({
  gold: Math.floor(copper / 10000),
  silver: Math.floor(copper / 100) % 100,
  copper: copper % 100,
});

/** Gold, /played, location, rest, quests, dungeon: under the paper doll. */
export function AddonStatus({ c }: { c: CharacterDetail }) {
  const t = useT();
  const lang = useLang();
  const [mapOpen, setMapOpen] = useState(false);
  const a = c.addon;
  if (!a) return null;
  const T = t.inGame;
  const money = knownMoney(a);
  const xp = xpView(c);
  const rest = xp && !c.isGhost ? restedNow(xp, { level: c.level, flavour: c.flavour, savedAt: a.updatedAt }) : null;

  const rows: [string, ReactNode][] = [];
  if (money != null) rows.push([T.gold, money > 0 ? <Money {...coins(money)} /> : "0"]);
  if (a.playedTotal != null)
    rows.push([
      T.played,
      <>
        {played(a.playedTotal, lang)}
        {a.playedLevel != null && <span className="text-ink-faint"> · {T.thisLevel(played(a.playedLevel, lang))}</span>}
      </>,
    ]);
  if (a.zone) {
    const place = (
      <>
        {a.subZone && a.subZone !== a.zone ? `${a.subZone}, ${a.zone}` : a.zone}
        {a.x != null && a.y != null && (
          <span className="text-ink-faint">
            {" "}
            ({a.x.toFixed(0)}, {a.y.toFixed(0)})
          </span>
        )}
      </>
    );
    const zoneMap = mapFor(a.mapId, a.zone);
    rows.push([
      T.location,
      zoneMap != null ? (
        <button type="button" onClick={() => setMapOpen(true)} title={t.map.show} className="inline-flex items-center gap-1 text-right hover:text-[#ffd100]">
          <MapPin className="size-3.5 shrink-0 text-[#ffd100]" />
          <span>{place}</span>
        </button>
      ) : (
        <span className="text-right">{place}</span>
      ),
    ]);
  }
  if (rest)
    rows.push([
      T.rest,
      <span className="text-[#7fa5ff]">
        {rest.full ? (
          T.fullyRested
        ) : (
          <>
            {Math.round((rest.rested / xp!.max) * 100)}% · {T.fullIn} <When iso={rest.fullAt!.toISOString()} />
          </>
        )}
        {xp?.resting && <span className="text-ink-faint"> · {T.resting}</span>}
      </span>,
    ]);
  if (a.questsCompleted > 0) rows.push([T.quests, a.questsCompleted.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")]);
  if (a.run)
    rows.push([
      T.dungeon,
      <>
        {a.run.name}
        {a.run.startedAt && (
          <span className="text-ink-faint">
            {" "}
            · <When iso={a.run.startedAt} />
          </span>
        )}
      </>,
    ]);
  if (a.updatedAt) rows.push([T.saved, <When iso={a.updatedAt} />]);
  if (!rows.length) return null;

  return (
    <div className="mt-3">
      <StatBox title={T.title} rows={rows} />
      {mapOpen && mapFor(a.mapId, a.zone) != null && (
        <MapPopup
          mapId={mapFor(a.mapId, a.zone)!}
          title={a.zone ?? ""}
          markers={zoneMarkers(c, mapFor(a.mapId, a.zone)!, t, lang)}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}

/** The character on its zone map, with its deaths and close calls there. */
function zoneMarkers(c: CharacterDetail, mapId: number, t: ReturnType<typeof useT>, lang: "en" | "fr"): MapMarker[] {
  const a = c.addon!;
  const out: MapMarker[] = [];
  for (const e of c.events) {
    const d = e.data;
    const placed = d.type === "death" || d.type === "closeCall" || (d.type === "pet" && d.action === "death");
    if (!placed || d.x == null || d.y == null) continue;
    if (mapFor(d.mapId, d.zone) !== mapId) continue;
    const date = fullDate(e.at, lang);
    out.push(
      d.type === "death"
        ? { x: d.x, y: d.y, kind: "death", label: t.map.died(date) }
        : d.type === "closeCall"
          ? { x: d.x, y: d.y, kind: "closeCall", label: t.map.closeCall(d.pct, date) }
          : { x: d.x, y: d.y, kind: "death", label: t.map.petDied(d.name, date) },
    );
  }
  if (a.x != null && a.y != null) out.push({ x: a.x, y: a.y, kind: "player", label: t.map.you });
  return out;
}

const PET_ICONS = petIcons as Record<string, string>;
const petIcon = (c: CharacterDetail, icon: number | null) =>
  icon != null && PET_ICONS[icon] ? iconUrl(c.flavour, c.region, PET_ICONS[icon]) : null;
const HAPPINESS_COLOR = ["", "#ff4040", "#ffd100", "#1eff00"];

/** The hunter's pet (or warlock's demon) and the stable, like the game's Pet tab. */
export function PetFrame({ c }: { c: CharacterDetail }) {
  const t = useT();
  const P = t.pet;
  const a = c.addon;
  const pet = a?.pet;
  const stable = a?.stable;
  if (!pet && !stable?.pets.length) return null;
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{P.title}</span>
      {pet && (
        <div>
          <div className="flex items-center gap-3">
            <span className="relative block size-[52px] shrink-0 rounded-[4px] bg-[url(/slots/bag-empty.png)] bg-cover">
              {petIcon(c, pet.icon) && <img src={petIcon(c, pet.icon)!} alt="" className="absolute inset-px size-[calc(100%-2px)] rounded-[3px]" />}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#ffd100] [text-shadow:0_1px_1px_#000]">{pet.name}</p>
              <p className="text-sm text-white">{P.level(pet.level, pet.family ?? "")}</p>
              {pet.hunter && pet.happiness != null && P.happiness[pet.happiness] && (
                <p className="text-xs" style={{ color: HAPPINESS_COLOR[pet.happiness] }}>
                  {P.happiness[pet.happiness]}
                </p>
              )}
              {!pet.active && pet.updatedAt && (
                <p className="text-xs text-ink-faint">
                  {P.inactive} <When iso={pet.updatedAt} />
                </p>
              )}
            </div>
          </div>
          {pet.hunter && pet.xpMax != null && pet.xp != null && (
            <div className="mt-3">
              <XpBar xp={pet.xp} max={pet.xpMax} />
            </div>
          )}
          {pet.hunter && (pet.loyalty || pet.trainingPoints != null) && (
            <div className="mt-3">
              <StatBox
                title={P.status}
                rows={[
                  ...(pet.loyalty ? ([[P.loyalty, pet.loyalty]] as [string, ReactNode][]) : []),
                  ...(pet.trainingPoints != null
                    ? ([[P.trainingLabel, P.training(pet.trainingPoints - (pet.trainingSpent ?? 0), pet.trainingPoints)]] as [string, ReactNode][])
                    : []),
                ]}
              />
            </div>
          )}
          {pet.abilities.length > 0 && (
            <div className="mt-3">
              <p className="wow-header mb-1 text-xs">{P.abilities}</p>
              <p className="text-sm text-ink">{pet.abilities.join(" · ")}</p>
            </div>
          )}
        </div>
      )}
      {stable && stable.pets.length > 0 && (
        <div className={pet ? "mt-5" : undefined}>
          <p className="wow-header mb-1 text-xs">{P.stable}</p>
          <p className="mb-2 text-xs text-ink-faint">
            {P.lastVisit} <When iso={stable.at} />
          </p>
          <ul className="flex flex-col gap-1.5">
            {stable.pets.map((s) => (
              <li key={s.slot} className="flex items-center gap-2.5 text-sm">
                <span className="relative block size-8 shrink-0 rounded-[4px] bg-[url(/slots/bag-empty.png)] bg-cover">
                  {petIcon(c, s.icon) && <img src={petIcon(c, s.icon)!} alt="" className="absolute inset-px size-[calc(100%-2px)] rounded-[3px]" />}
                </span>
                <span className="text-[#ffd100]">{s.name}</span>
                <span className="text-ink-dim">{P.level(s.level, s.family ?? "")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * A bar like the game's skill and reputation bars: the UI-Character-Skills-Bar
 * texture tinted with the bar's colour, inside the skill bar border (drawn as
 * a 9-slice so its rounded ends survive any width). Name left, value right.
 */
function Bar({ pct, color, background, left, right, title }: { pct: number; color: string; background: string; left: ReactNode; right: ReactNode; title?: string }) {
  return (
    <div className="relative mx-[3px] h-[15px]" title={title}>
      <div className="absolute inset-0" style={{ backgroundColor: background }} />
      <div
        className="absolute inset-y-0 left-0 bg-[url(/ui/skill-bar.png)] bg-[length:100%_100%] bg-blend-multiply"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
      />
      <span
        className="pointer-events-none absolute -inset-[3px] border-[5px] border-solid"
        style={{ borderImage: "url(/ui/skill-border.png) 5 / 5px stretch" }}
      />
      <div className="relative flex h-full items-center justify-between gap-2 px-2 text-xs leading-none text-white [text-shadow:0_1px_1px_#000]">
        <span className="truncate">{left}</span>
        <span className="shrink-0 tabular-nums">{right}</span>
      </div>
    </div>
  );
}

// Skill bars: the game's blue (SkillFrame.xml BarColor 0.25, 0.25, 0.75). The empty
// part is the dark recess of the reputation bars rather than the game's 20%
// white, which reads too light on these darker frames.
const SKILL_BLUE = "rgb(64 64 191)";
const BAR_RECESS = "rgb(0 0 0 / 0.5)";

export function SkillsFrame({ a }: { a: AddonState }) {
  const t = useT();
  const sections = skillSections(a.skills);
  if (!sections.length) return null;
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{t.inGame.skills}</span>
      <div className="flex flex-col gap-4">
        {sections.map((s) => (
          <div key={s.name}>
            {s.name && <p className="wow-header mb-1.5 text-xs">{s.name}</p>}
            <div className="flex flex-col gap-2">
              {s.skills.map((k) => (
                <Bar
                  key={k.name}
                  pct={(k.rank / (k.max || 1)) * 100}
                  color={SKILL_BLUE}
                  background={BAR_RECESS}
                  left={k.name}
                  right={`${k.rank}/${k.max}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReputationFrame({ a }: { a: AddonState }) {
  const t = useT();
  const lang = useLang();
  if (!a.reputations.length) return null;
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{t.inGame.reputation}</span>
      <div className="flex flex-col gap-2">
        {sortedReputations(a.reputations).map((r) => {
          const s = standing(r.standing);
          return (
            <Bar
              key={r.name}
              pct={(r.value / (r.max || 1)) * 100}
              color={s.color}
              background={BAR_RECESS}
              left={r.name}
              right={lang === "fr" ? s.fr : s.en}
              title={`${r.value} / ${r.max}`}
            />
          );
        })}
      </div>
    </section>
  );
}

/** The mailbox as of its last opening, and timed crafts. */
export function MailFrame({ a }: { a: AddonState }) {
  const t = useT();
  const T = t.inGame;
  const now = Date.now();
  // Letters past their expiry are gone in game (returned or deleted).
  const letters = (a.mail?.letters ?? []).filter((l) => new Date(l.expiresAt).getTime() > now);
  const cooldowns = a.cooldowns;
  const showMail = a.mail && (letters.length > 0 || a.mail.hasNew || a.mail.readAt);
  if (!showMail && !cooldowns.length) return null;

  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{cooldowns.length && !showMail ? T.cooldowns : T.mailbox}</span>
      {showMail && (
        <div>
          <p className="mb-2 text-xs text-ink-faint">
            {a.mail!.hasNew && <span className="mr-2 font-semibold text-[#ffd100]">✉ {T.newMail}</span>}
            {a.mail!.readAt && (
              <>
                {T.asOf} <When iso={a.mail!.readAt} />
              </>
            )}
          </p>
          {letters.length === 0 ? (
            <p className="text-sm text-ink-dim">{T.noMail}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {[...letters]
                .sort((x, y) => x.expiresAt.localeCompare(y.expiresAt))
                .map((l, i) => {
                  const soon = new Date(l.expiresAt).getTime() - now < 86400_000;
                  return (
                    <li key={i} className="rounded border border-[#3a3a3a] bg-black/40 px-2.5 py-1.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="min-w-0 truncate">
                          <span className="text-[#ffd100]">{l.sender ?? "?"}</span>
                          {l.subject && <span className="text-ink-dim"> · {l.subject}</span>}
                        </span>
                        <span className={cn("shrink-0 text-xs", soon ? "font-semibold text-q-danger" : "text-ink-faint")}>
                          {T.expires} <When iso={l.expiresAt} /> · {l.onExpiry === "returned" ? T.returned : T.deleted}
                        </span>
                      </div>
                      {(l.items.length > 0 || l.money > 0) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
                          {l.items.map((it, j) => (
                            <span key={j} className="q" data-q={["poor", "common", "uncommon", "rare", "epic", "legendary"][it.quality ?? 1]}>
                              [{it.name}]{it.count > 1 ? `×${it.count}` : ""}
                            </span>
                          ))}
                          {l.money > 0 && <Money {...coins(l.money)} />}
                        </p>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
      {cooldowns.length > 0 && (
        <div className={cn(showMail && "mt-4")}>
          {showMail && <p className="wow-header mb-1.5 text-xs">{T.cooldowns}</p>}
          <dl className="space-y-0.5 text-sm">
            {cooldowns.map((cd, i) => {
              const ready = new Date(cd.readyAt).getTime() <= now;
              return (
                <div key={i} className="flex justify-between gap-3">
                  <dt className="text-[#ffd100]">{cd.name ?? "?"}</dt>
                  <dd className={ready ? "text-q-uncommon" : "text-ink-dim"}>
                    {ready ? (
                      T.ready
                    ) : (
                      <>
                        {T.readyIn} <When iso={cd.readyAt} />
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </section>
  );
}

/** /played at each level reached: the levelling pace. */
export function LevellingFrame({ a }: { a: AddonState }) {
  const t = useT();
  const lang = useLang();
  const rows = levelling(a.levelPlayed);
  if (rows.length < 2) return null;
  return (
    <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
      <span className="wow-title">{t.inGame.levelling}</span>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-faint">
            <th className="pb-1 font-normal">{t.inGame.level}</th>
            <th className="pb-1 font-normal">{t.inGame.reachedAt}</th>
            <th className="pb-1 text-right font-normal">{t.inGame.took}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.level} className="border-t border-white/5">
              <td className="py-1 font-semibold text-[#ffd100] tabular-nums">{r.level}</td>
              <td className="py-1 text-ink-dim tabular-nums">{played(r.played, lang)}</td>
              <td className="py-1 text-right tabular-nums">{r.took != null ? played(r.took, lang) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
