import { REGIONS, type Realm, type Region } from "@wow-locker/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { addToRoster } from "@/lib/roster";
import { createStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { isHardcoreRealm, realmLabel } from "@/lib/wow";

/** Remember the last region + realm: you usually add alts on the same realm. */
const lastPick = createStore<{ region: Region; realm: string | null }>("wow-locker:last-realm", { region: "eu", realm: null });

const realmKey = (r: Realm) => `${r.flavour}:${r.slug}`;

export function AddCharacterDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const remembered = lastPick.get();
  const [region, setRegion] = useState<Region>(remembered.region);
  const [realm, setRealm] = useState<string | null>(remembered.realm);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  const realms = useQuery({ queryKey: ["realms", region], queryFn: () => api.realms(region), staleTime: 3600_000 });
  const selected = realms.data?.find((r) => realmKey(r) === realm) ?? null;

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = (realms.data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
    // Hardcore first, then by name: it's what this app is mostly for.
    return list.sort((a, b) => Number(isHardcoreRealm(b)) - Number(isHardcoreRealm(a)) || a.name.localeCompare(b.name));
  }, [realms.data, filter]);

  const add = useMutation({
    mutationFn: () => api.add({ region, flavour: selected!.flavour, realm: selected!.slug, name: name.trim() }),
    onSuccess: (c) => {
      addToRoster(c.id);
      lastPick.set({ region, realm });
      void qc.invalidateQueries({ queryKey: ["characters"] });
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (selected && name.trim()) add.mutate();
  };

  const error =
    add.error instanceof ApiError
      ? add.error.status === 404
        ? t.add.notFound
        : add.error.status === 400
          ? t.add.invalid
          : t.add.down
      : add.error
        ? t.add.down
        : null;

  // On <body>: above the top and bottom bars (the page content is isolated
  // below them, see Layout).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t.add.title}
      onClick={onClose}
    >
      <form className="wow-frame flex max-h-[90dvh] w-full max-w-md flex-col px-5 pt-8 pb-5" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <span className="wow-title">{t.add.title}</span>
        <button type="button" className="icon-btn absolute top-1.5 right-1.5" onClick={onClose} aria-label={t.add.cancel}>
          <X className="size-5" />
        </button>

        <div className="flex justify-center gap-2" role="radiogroup" aria-label={t.add.region}>
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={region === r}
              onClick={() => {
                setRegion(r);
                setRealm(null);
              }}
              className={cn("wow-btn wow-btn-sm min-w-20 uppercase", region !== r && "wow-btn-dark")}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="mt-4 text-sm text-[#ffd100]">{t.add.realm}</label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={selected ? `${selected.name} · ${realmLabel(selected)}` : t.add.realmSearch}
            className="wow-input pl-8"
          />
        </div>
        <ul className="mt-1.5 max-h-52 min-h-24 overflow-y-auto rounded border border-[#3a3a3a] bg-black/60 p-1 shadow-[inset_0_1px_4px_rgb(0_0_0/0.9)]" role="listbox">
          {realms.isPending && <li className="p-2 text-sm text-ink-faint">…</li>}
          {shown.map((r) => {
            const on = realmKey(r) === realm;
            const label = realmLabel(r);
            return (
              <li key={realmKey(r)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setRealm(realmKey(r));
                    setFilter("");
                    nameInput.current?.focus();
                  }}
                  className={cn("wow-row flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm", on ? "text-white" : "text-[#ffd100]")}
                >
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className={cn("text-[11px]", label === "Hardcore" ? "font-semibold text-q-danger" : "text-ink-faint")}>
                    {label} · {r.type}
                  </span>
                  {on && <Check className="size-4 text-gold" />}
                </button>
              </li>
            );
          })}
        </ul>

        <label className="mt-4 text-sm text-[#ffd100]" htmlFor="char-name">
          {t.add.name}
        </label>
        <input
          id="char-name"
          ref={nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={12}
          className="wow-input mt-1.5"
        />

        {error && <p className="mt-3 text-sm text-q-legendary">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="wow-btn wow-btn-dark" onClick={onClose}>
            {t.add.cancel}
          </button>
          <button type="submit" className="wow-btn" disabled={!selected || !name.trim() || add.isPending}>
            {add.isPending ? t.add.adding : selected ? t.add.submit : t.add.pickRealm}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
