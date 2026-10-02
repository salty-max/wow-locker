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
        <div className="flex gap-1" role="radiogroup">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={region === r}
              onClick={() => setRegion(r)}
              className={cn("wow-btn wow-btn-sm px-2.5 uppercase", region === r ? "wow-btn-bnet" : "wow-btn-dark text-ink-faint")}
            >
              {r}
            </button>
          ))}
        </div>
        <a href={api.loginUrl(region)} className="wow-btn wow-btn-bnet flex-1">
          <LogIn className="size-4" /> {t.bnet.login}
        </a>
      </div>
      {!compact && <p className="max-w-sm text-center text-xs text-ink-faint">{t.bnet.loginHint}</p>}
    </div>
  );
}
