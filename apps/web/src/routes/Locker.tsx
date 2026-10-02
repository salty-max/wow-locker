import type { CharacterSummary } from "@wow-locker/shared";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Skull } from "lucide-react";
import { useMemo, useState } from "react";
import { AddCharacterDialog } from "@/components/AddCharacterDialog";
import { StatusBadges } from "@/components/Badges";
import { BnetLogin } from "@/components/BnetLogin";
import { CharacterRender } from "@/components/CharacterRender";
import { Logo } from "@/components/Logo";
import { When } from "@/components/When";
import { XpBar } from "@/components/XpBar";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useRoster } from "@/lib/roster";
import { cn } from "@/lib/utils";
import { realmLabel } from "@/lib/wow";

/**
 * The locker as the Classic character selection screen: the selected character
 * on a lit stage (desktop), the roster as the character list on the right.
 */
export function Locker() {
  const t = useT();
  const navigate = useNavigate();
  const { ids } = useRoster();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["characters", ids],
    queryFn: () => api.characters(ids),
    enabled: ids.length > 0,
    refetchInterval: 60_000,
  });
  const list = useMemo(() => {
    const byId = new Map((q.data ?? []).map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter((c) => c != null);
  }, [q.data, ids]);
  const selected = list.find((c) => c.id === selectedId) ?? list[0];
  const open = (c: CharacterSummary) => void navigate({ to: "/character/$id", params: { id: String(c.id) } });

  if (ids.length === 0) {
    return (
      <div className="wow-frame mx-auto mt-6 flex max-w-md flex-col items-center gap-4 px-6 pt-10 pb-7 text-center">
        <span className="wow-title">{t.locker.title}</span>
        <Logo size={64} />
        <p className="text-sm text-ink-dim">{t.locker.empty}</p>
        <BnetLogin />
        <button className="wow-btn" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t.bnet.or}
        </button>
        {adding && <AddCharacterDialog onClose={() => setAdding(false)} />}
      </div>
    );
  }

  // Desktop: exactly the window under the top bar (3.5rem + its 1px border)
  // minus main's padding (1.25rem + 2.5rem), so the page never scrolls.
  return (
    <div className="grid items-start gap-6 md:h-[calc(100dvh-8.5rem-1px)] md:grid-cols-[1fr_20rem] md:items-stretch">
      {/* The stage: desktop only — on phones the list opens characters directly. */}
      <section className="hidden min-h-0 md:block">
        {selected ? (
          <div className="flex h-full flex-col items-center">
            {/* The model takes whatever height the info block leaves. */}
            <div className={cn("relative min-h-48 w-full flex-1", selected.isGhost && "fallen")}>
              <div className="absolute inset-x-[15%] bottom-2 h-10 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgb(255_209_0/0.18),transparent_70%)]" />
              <CharacterRender url={selected.renderUrl} avatarUrl={selected.avatarUrl} className="h-full w-full" />
            </div>
            {/* Fixed-height lines, filled or not, so switching characters never
                moves anything (not everyone has badges or an XP bar). */}
            <div className="mt-2 flex w-full max-w-sm shrink-0 flex-col items-center text-center">
              <p className="cc title-display h-10 w-full truncate text-3xl leading-10 [text-shadow:0_2px_4px_#000]" data-c={selected.classKey ?? undefined}>
                {selected.name}
              </p>
              <p className="h-6 w-full truncate text-[#ffd100] [text-shadow:0_1px_1px_#000]">
                {t.card.level(selected.level)} {selected.race} {selected.className}
              </p>
              <p className="h-5 w-full truncate text-xs text-ink-faint">
                {selected.realmName} ·{" "}
                {(() => {
                  const label = realmLabel({ region: selected.region, slug: selected.realmSlug, flavour: selected.flavour, category: selected.realmCategory });
                  return <span className={cn(label === "Hardcore" && "font-semibold text-q-danger")}>{label}</span>;
                })()}
              </p>
              <div className="mt-1 flex h-6 items-center justify-center">
                <StatusBadges c={selected} />
              </div>
              <div className="mt-1 h-9 w-72">
                {!selected.isGhost && selected.xpToNext != null && <XpBar xp={selected.experience} max={selected.xpToNext} />}
              </div>
              <button className="wow-btn mt-2 px-8 text-base" onClick={() => open(selected)}>
                {t.locker.view}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full animate-pulse rounded-lg bg-stone-2/40" />
        )}
      </section>

      {/* The character list. */}
      <section className="wow-frame flex min-h-0 flex-col px-2 pt-7 pb-3">
        <span className="wow-title">{t.locker.title}</span>
        {q.isError ? (
          <div className="p-4 text-center">
            <p className="text-sm text-ink-dim">{t.locker.error}</p>
            <button className="wow-btn wow-btn-sm mt-3" onClick={() => void q.refetch()}>
              {t.locker.retry}
            </button>
          </div>
        ) : (
          <ul role="listbox" aria-label={t.locker.title} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {(q.isPending ? [] : list).map((c) => (
              <li key={c.id}>
                <button
                  role="option"
                  aria-selected={selected?.id === c.id}
                  onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setSelectedId(c.id) : open(c))}
                  onDoubleClick={() => open(c)}
                  className="wow-row flex w-full items-center gap-3 px-2.5 py-2 text-left"
                >
                  <span className={cn("relative shrink-0", c.isGhost && "fallen")}>
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="size-10 rounded-full border-2 border-[#8a7330] object-cover" />
                    ) : (
                      <span className="block size-10 rounded-full border-2 border-[#8a7330] bg-stone-3" />
                    )}
                    {c.isGhost && <Skull className="absolute -right-1 -bottom-1 size-4 rounded-full bg-black p-0.5 text-q-danger" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-semibold [text-shadow:0_1px_1px_#000]", c.isGhost ? "text-q-poor" : "text-[#ffd100]")}>
                      {c.name}
                    </span>
                    <span className="block truncate text-xs text-white/85">
                      {t.card.level(c.level)} <span className="cc" data-c={c.classKey ?? undefined}>{c.className}</span>
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {c.realmName} ·{" "}
                      {c.status === "not_found" ? (
                        <span className="text-q-legendary">{t.card.missing}</span>
                      ) : c.lastLoginAt ? (
                        <>
                          {t.card.lastSeen} <When iso={c.lastLoginAt} />
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {q.isPending && ids.map((id) => <li key={id} className="mx-2 my-1 h-14 animate-pulse rounded bg-stone-2/50" />)}
          </ul>
        )}
        <div className="mt-3 flex shrink-0 justify-center border-t border-white/5 pt-3">
          <button className="wow-btn" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {t.locker.add}
          </button>
        </div>
      </section>

      {adding && <AddCharacterDialog onClose={() => setAdding(false)} />}
    </div>
  );
}
