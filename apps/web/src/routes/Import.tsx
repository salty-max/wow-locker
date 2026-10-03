import type { AccountCharacter } from "@wow-locker/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Check, Skull, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BnetLogin } from "@/components/BnetLogin";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { addToRoster, useRoster } from "@/lib/roster";
import { cn } from "@/lib/utils";
import { flavourLabel, VERSION_LABEL, VERSIONS, versionOf, type Version } from "@/lib/wow";

const route = getRouteApi("/import");
const keyOf = (c: AccountCharacter) => `${c.flavour}:${c.realmSlug}:${c.name}`;
const versionOfChar = (c: AccountCharacter) => versionOf({ region: c.region, slug: c.realmSlug, flavour: c.flavour, category: c.realmCategory });

export function Import() {
  const t = useT();
  const qc = useQueryClient();
  const { k, error } = route.useSearch();
  const { ids } = useRoster();
  const q = useQuery({
    queryKey: ["import", k],
    queryFn: () => api.accountImport(k!),
    enabled: !!k,
    retry: false,
    staleTime: Infinity,
    // The server reads each character's dead/alive status after the list: poll until done.
    refetchInterval: (query) => (query.state.data?.checking ? 1500 : false),
  });

  // Per game version, highest level first.
  const all = useMemo(() => [...(q.data?.characters ?? [])].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)), [q.data]);
  const counts = useMemo(() => {
    const m = new Map<Version, number>();
    for (const c of all) m.set(versionOfChar(c), (m.get(versionOfChar(c)) ?? 0) + 1);
    return m;
  }, [all]);
  const present = VERSIONS.filter((v) => counts.has(v));
  const [version, setVersion] = useState<Version | "all" | null>(null);
  // Default: Hardcore when the account has some, else the first version present.
  const active = version ?? present[0] ?? "all";
  const list = useMemo(() => (active === "all" ? all : all.filter((c) => versionOfChar(c) === active)), [all, active]);
  const inLocker = (c: AccountCharacter) => c.trackedId != null && ids.includes(c.trackedId);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    // Preselect what's worth tracking: alive, level 10+, not in the locker yet.
    // Re-applied as statuses come in, until the user changes the selection.
    if (touched) return;
    setPicked(new Set(all.filter((c) => c.level >= 10 && c.isGhost !== true && !inLocker(c)).map(keyOf)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, touched]);
  const pick = (next: Set<string>) => {
    setTouched(true);
    setPicked(next);
  };
  const checked = all.filter((c) => c.isGhost !== null).length;

  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const addSelected = async () => {
    // Only what's visible: the filter is also "what am I adding".
    const chosen = list.filter((c) => picked.has(keyOf(c)) && !inLocker(c));
    setProgress({ done: 0, total: chosen.length, failed: 0 });
    let failed = 0;
    for (const [i, c] of chosen.entries()) {
      try {
        const added = await api.add({ region: c.region, flavour: c.flavour, realm: c.realmSlug, name: c.name });
        addToRoster(added.id);
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: chosen.length, failed });
    }
    void qc.invalidateQueries({ queryKey: ["characters"] });
  };

  const problem = error
    ? error === "access_denied" || error === "cancelled"
      ? t.import.cancelled
      : t.import.failed
    : q.error instanceof ApiError && q.error.status === 404
      ? t.import.expired
      : q.error
        ? t.import.failed
        : null;

  if (problem || !k) {
    return (
      <div className="wow-frame mx-auto flex max-w-md flex-col items-center gap-4 px-6 pt-9 pb-7 text-center">
        <span className="wow-title">{t.import.title}</span>
        <p className="text-sm text-ink-dim">{problem ?? t.import.expired}</p>
        <BnetLogin />
      </div>
    );
  }

  const finished = progress && progress.done === progress.total;
  const selectedVisible = list.filter((c) => picked.has(keyOf(c)) && !inLocker(c)).length;

  return (
    <div className="wow-frame mx-auto max-w-2xl space-y-3 px-3 pt-9 pb-4 sm:px-5">
      <span className="wow-title">{t.import.title}</span>
      {q.isPending ? (
        <div className="animate-pulse p-8 text-center text-sm text-ink-dim">{t.import.loading}</div>
      ) : (
        <>
          {q.data!.unavailable.length > 0 && (
            <p className="px-1 text-xs text-q-legendary">{t.import.unavailable(q.data!.unavailable.map((f) => flavourLabel[f]).join(", "))}</p>
          )}
          {present.length > 1 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {present.map((v) => (
                <button key={v} className={cn("wow-btn wow-btn-sm shrink-0", active !== v && "wow-btn-dark")} aria-pressed={active === v} onClick={() => setVersion(v)}>
                  {VERSION_LABEL[v]}
                  <span className="text-xs text-white/60 tabular-nums">{counts.get(v)}</span>
                </button>
              ))}
              <button className={cn("wow-btn wow-btn-sm shrink-0", active !== "all" && "wow-btn-dark")} aria-pressed={active === "all"} onClick={() => setVersion("all")}>
                {t.import.all} <span className="text-xs text-white/60 tabular-nums">{all.length}</span>
              </button>
            </div>
          )}
          {all.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-dim">{t.import.none}</p>
          ) : (
            <div className="divide-y divide-white/5 rounded border border-[#3a3a3a] bg-black/50 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]">
              <div className="flex flex-wrap gap-3 px-4 py-2 text-xs">
                <button
                  className="text-ink-dim hover:text-parchment"
                  onClick={() => pick(new Set([...picked, ...list.filter((c) => !inLocker(c)).map(keyOf)]))}
                >
                  {t.import.selectAll}
                </button>
                <button
                  className="text-ink-dim hover:text-parchment"
                  onClick={() => pick(new Set([...picked].filter((k) => !list.some((c) => keyOf(c) === k))))}
                >
                  {t.import.selectNone}
                </button>
                {q.data!.checking && (
                  <span className="ml-auto animate-pulse text-ink-faint">{t.import.checking(checked, all.length)}</span>
                )}
              </div>
              {list.map((c) => {
                const already = inLocker(c);
                const on = picked.has(keyOf(c));
                const label = VERSION_LABEL[versionOfChar(c)];
                return (
                  <label key={keyOf(c)} className={cn("flex items-center gap-3 px-4 py-2.5", already ? "opacity-60" : "cursor-pointer hover:bg-stone-2/60")}>
                    <input
                      type="checkbox"
                      className="wow-check"
                      checked={already || on}
                      disabled={already || !!progress}
                      onChange={() => {
                        const next = new Set(picked);
                        if (on) next.delete(keyOf(c));
                        else next.add(keyOf(c));
                        pick(next);
                      }}
                    />
                    <span className="w-8 text-right font-bold text-gold tabular-nums">{c.level}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={cn("cc font-display", c.isGhost && "opacity-60 grayscale")} data-c={c.classKey ?? undefined}>
                          {c.name}
                        </span>
                        {c.isGhost && (
                          <span className="inline-flex items-center gap-1 rounded border border-q-poor/60 px-1 text-[10px] font-bold tracking-wider text-q-poor uppercase">
                            <Skull className="size-3" /> {t.card.dead}
                          </span>
                        )}
                        {c.isSelfFound && (
                          <span className="inline-flex items-center gap-1 rounded border border-q-uncommon/40 px-1 text-[10px] font-bold tracking-wider text-q-uncommon uppercase">
                            <Sprout className="size-3" /> {t.card.selfFound}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-faint">
                        {c.className} · {c.realmName} ·{" "}
                        <span className={cn(label === "Hardcore" && "font-semibold text-q-danger")}>{label}</span>
                      </span>
                    </span>
                    {already && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-q-uncommon">
                        <Check className="size-3.5" /> {t.import.tracked}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 px-1">
            {finished ? (
              <Link to="/" className="wow-btn">
                {t.import.done}
              </Link>
            ) : (
              <button className="wow-btn" disabled={selectedVisible === 0 || !!progress} onClick={addSelected}>
                {progress ? t.import.adding(progress.done, progress.total) : t.import.add(selectedVisible)}
              </button>
            )}
            {progress && progress.failed > 0 && <span className="text-xs text-q-legendary">{t.import.errors(progress.failed)}</span>}
          </div>
        </>
      )}
    </div>
  );
}
