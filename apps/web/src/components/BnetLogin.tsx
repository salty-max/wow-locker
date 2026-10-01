import { REGIONS, type Region } from "@wow-locker/shared";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Log in with Battle.net" with a region switch (EU/US accounts are separate). */
export function BnetLogin({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [region, setRegion] = useState<Region>("eu");
  return (
    <div className={cn("flex flex-col items-center gap-2", compact && "items-stretch")}>
      <div className={cn("flex w-full gap-2", !compact && "max-w-xs")}>
        <div className="flex rounded-lg border border-edge bg-stone-2 p-0.5" role="radiogroup">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={region === r}
              onClick={() => setRegion(r)}
              className={cn("rounded-md px-2.5 text-xs uppercase", region === r ? "bg-stone-3 font-semibold text-gold" : "text-ink-faint")}
            >
              {r}
            </button>
          ))}
        </div>
        <a
          href={api.loginUrl(region)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#148eff] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3aa0ff]"
        >
          <LogIn className="size-4" /> {t.bnet.login}
        </a>
      </div>
      {!compact && <p className="max-w-sm text-center text-xs text-ink-faint">{t.bnet.loginHint}</p>}
    </div>
  );
}
