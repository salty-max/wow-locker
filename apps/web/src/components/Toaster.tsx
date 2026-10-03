import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CharacterSummary } from "@wow-locker/shared";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useRoster } from "@/lib/roster";
import { dismiss, toast, useToasts } from "@/lib/toast";

/** The toasts, bottom right (above the action bar on phones), in the game's frame. */
export function Toaster() {
  const t = useT();
  const items = useToasts();
  return (
    <div className="pointer-events-none fixed right-3 bottom-24 z-[55] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 sm:bottom-4">
      {items.map((x) => (
        <div
          key={x.id}
          role="status"
          className="wow-frame pointer-events-auto animate-[toast-in_160ms_ease-out] px-3 py-2.5 motion-reduce:animate-none"
        >
          <button
            type="button"
            onClick={() => dismiss(x.id)}
            aria-label={t.toast.close}
            className="absolute top-1.5 right-1.5 text-ink-faint hover:text-white"
          >
            <X className="size-3.5" />
          </button>
          {x.href ? (
            <Link to={x.href} onClick={() => dismiss(x.id)} className="block pr-4">
              <p className="text-sm font-semibold text-[#ffd100] [text-shadow:0_1px_1px_#000]">{x.title}</p>
              {x.body && <p className="text-xs text-ink-dim">{x.body}</p>}
            </Link>
          ) : (
            <div className="pr-4">
              <p className="text-sm font-semibold text-[#ffd100] [text-shadow:0_1px_1px_#000]">{x.title}</p>
              {x.body && <p className="text-xs text-ink-dim">{x.body}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Watches this device's locker while the app is open (every minute, like the
 * locker itself) and toasts when a character changes: new timeline events, or
 * a fresh upload from the companion. The character's page data is refreshed.
 */
export function CharacterWatcher() {
  const t = useT();
  const qc = useQueryClient();
  const { ids } = useRoster();
  const q = useQuery({
    queryKey: ["characters", ids],
    queryFn: () => api.characters(ids),
    enabled: ids.length > 0,
    refetchInterval: 60_000,
  });
  const seen = useRef(new Map<number, Pick<CharacterSummary, "lastEventAt" | "addonSyncedAt">>());

  useEffect(() => {
    for (const c of q.data ?? []) {
      const before = seen.current.get(c.id);
      seen.current.set(c.id, { lastEventAt: c.lastEventAt, addonSyncedAt: c.addonSyncedAt });
      if (!before) continue; // first sight: no toast
      const newEvents = c.lastEventAt != null && c.lastEventAt !== before.lastEventAt;
      const synced = c.addonSyncedAt != null && c.addonSyncedAt !== before.addonSyncedAt;
      if (!newEvents && !synced) continue;
      toast({
        title: t.toast.updated(c.name),
        body: newEvents ? t.toast.newEvents : t.toast.synced,
        href: `/character/${c.id}`,
      });
      void qc.invalidateQueries({ queryKey: ["character", c.id] });
    }
  }, [q.data, qc, t]);

  return null;
}
