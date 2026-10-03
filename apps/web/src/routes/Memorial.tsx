import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Skull } from "lucide-react";
import { ChatFrame } from "@/components/ChatLog";
import { DangersView } from "@/components/Dangers";
import { When } from "@/components/When";
import { played } from "@/lib/addonView";
import { api } from "@/lib/api";
import { hasDangers } from "@/lib/dangers";
import { useLang, useT } from "@/lib/i18n";
import { useTitle } from "@/lib/useTitle";
import { useRoster } from "@/lib/roster";
import { cn } from "@/lib/utils";

/**
 * The memorial: the roster's fallen characters, each with the way it fell and
 * its last hour as the chat showed it, then what threatens all of them (close
 * calls and deaths by foe, place and dungeon).
 */
export function Memorial() {
  const t = useT();
  useTitle(t.memorial.title);
  const lang = useLang();
  const M = t.memorial;
  const { ids } = useRoster();
  const q = useQuery({ queryKey: ["memorial", ids], queryFn: () => api.memorial(ids), enabled: ids.length > 0 });
  const m = q.data;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/today" className="wow-btn wow-btn-dark wow-btn-sm mb-6">
        <ArrowLeft className="size-3.5" /> {M.back}
      </Link>

      <section className="wow-frame px-3 pt-8 pb-4 sm:px-5">
        <h1 className="wow-title">{M.fallen}</h1>
        {!m ? (
          q.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-ink-dim">{t.common.loadError}</p>
              <button type="button" className="wow-btn wow-btn-sm" onClick={() => void q.refetch()}>
                {t.common.retry}
              </button>
            </div>
          ) : (
            <div aria-busy="true" className={cn("space-y-3 py-2", ids.length > 0 && "animate-pulse")}>
              <span className="sr-only" role="status">
                {t.common.loading}
              </span>
              <span className="block h-16 rounded bg-stone-2/60" />
              <span className="block h-28 rounded bg-stone-2/60" />
            </div>
          )
        ) : m.fallen.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-dim">{M.none}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {m.fallen.map((f) => {
              const c = f.character;
              const events = f.death ? [f.death, ...f.lastMoments] : f.lastMoments;
              const detailed = f.death?.data.type === "death" && (f.death.data.killer || f.death.data.zone || f.death.data.instance);
              return (
                <article key={c.id} className="rounded border border-[#3a3a3a] bg-black/35 p-3">
                  <div className="flex items-center gap-3">
                    <span className="fallen relative shrink-0">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="size-14 rounded-full border-2 border-[#5a5a5a] object-cover" />
                      ) : (
                        <span className="block size-14 rounded-full border-2 border-[#5a5a5a] bg-stone-3" />
                      )}
                      <Skull className="absolute -right-1 -bottom-1 size-5 rounded-full bg-black p-0.5 text-q-danger" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/character/$id"
                        params={{ id: String(c.id) }}
                        className="block truncate font-semibold text-q-poor [text-shadow:0_1px_1px_#000] hover:text-white"
                      >
                        {c.name}
                      </Link>
                      <p className="truncate text-sm text-white/85">
                        {t.card.level(c.level)} {c.race} {c.className}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {c.realmName}
                        {c.deadAt && (
                          <>
                            {" · "}
                            {t.card.deadOn} <When iso={f.death?.at ?? c.deadAt} />
                          </>
                        )}
                        {f.played != null && (
                          <>
                            {" · "}
                            {M.played} {played(f.played, lang)}
                          </>
                        )}
                        {f.questsCompleted ? (
                          <>
                            {" · "}
                            {M.quests} {f.questsCompleted}
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {events.length > 0 && (
                    <div className="mt-3">
                      <p className="wow-header mb-1 text-xs">{M.lastMoments}</p>
                      <ChatFrame events={events} who={{ ...c, equipment: [] }} className="max-h-56" />
                      {f.lastMoments.length === 0 && <p className="mt-1 text-xs text-ink-faint">{M.noMoments}</p>}
                    </div>
                  )}
                  {!detailed && <p className="mt-2 text-xs text-ink-faint">{M.noDetails}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {m && (
        <section className="wow-frame mt-10 px-3 pt-8 pb-4 sm:px-5">
          <h2 className="wow-title">{M.dangers}</h2>
          <p className="mb-3 text-xs text-ink-faint">{M.dangersHint}</p>
          {hasDangers(m.dangers) ? <DangersView d={m.dangers} /> : <p className="text-sm text-ink-dim">{t.dangers.none}</p>}
        </section>
      )}
    </div>
  );
}
