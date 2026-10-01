import { REGIONS } from "@wow-locker/shared";
import { ChevronDown, Download, LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setAccount, useAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Battle.net login status in the top bar: a login button, or your BattleTag + menu. */
export function AccountMenu() {
  const t = useT();
  const acc = useAccount();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "wow-row flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#ffd100] [text-shadow:0_1px_1px_#000]";

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors",
          acc ? "border border-[#148eff]/50 bg-[#148eff]/10 text-[#7cc4ff] hover:bg-[#148eff]/20" : "bg-[#148eff] text-white hover:bg-[#3aa0ff]",
        )}
      >
        {acc ? <UserRound className="size-4" /> : <LogIn className="size-4" />}
        <span className="max-w-24 truncate sm:max-w-32">{acc ? (acc.battletag ?? "Battle.net") : t.account.login}</span>
        {acc && <span className="text-[10px] uppercase opacity-70">{acc.region}</span>}
        <ChevronDown className="size-3.5 opacity-70" />
      </button>

      {open && (
        <div className="wow-frame absolute top-11 right-0 z-40 w-64 p-2">
          {acc ? (
            <>
              <p className="px-3 pt-1.5 pb-2 text-xs text-ink-faint">
                {t.account.loggedInAs} <span className="text-[#7cc4ff]">{acc.battletag ?? "Battle.net"}</span> ({acc.region.toUpperCase()})
              </p>
              <a className={item} href={api.loginUrl(acc.region)}>
                <Download className="size-4" /> {t.account.import}
              </a>
              {REGIONS.filter((r) => r !== acc.region).map((r) => (
                <a key={r} className={item} href={api.loginUrl(r)}>
                  <LogIn className="size-4" /> {t.account.switchRegion(r.toUpperCase())}
                </a>
              ))}
              <button
                className={item}
                onClick={() => {
                  setAccount(null);
                  setOpen(false);
                }}
              >
                <LogOut className="size-4" /> {t.account.logout}
              </button>
            </>
          ) : (
            <>
              <p className="px-3 pt-1.5 pb-2 text-xs text-ink-faint">{t.account.hint}</p>
              {REGIONS.map((r) => (
                <a key={r} className={item} href={api.loginUrl(r)}>
                  <LogIn className="size-4" /> {t.account.loginRegion(r.toUpperCase())}
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
