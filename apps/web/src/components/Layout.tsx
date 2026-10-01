import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, Settings } from "lucide-react";
import { useEffect } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Logo } from "@/components/Logo";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useT } from "@/lib/i18n";
import { resyncPush } from "@/lib/notifications";
import { useRoster } from "@/lib/roster";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function Layout() {
  const t = useT();
  const { lang, events } = useSettings();
  const { ids } = useRoster();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The server pushes per device for the characters in its roster: keep its
  // copy of roster, event choices and language in sync.
  useEffect(() => {
    void resyncPush().catch(() => {});
  }, [lang, events, ids]);

  const tabs = [
    { to: "/", label: t.nav.locker, icon: Package, active: path === "/" || path.startsWith("/character") },
    { to: "/settings", label: t.nav.settings, icon: Settings, active: path === "/settings" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col">
      <header className="pt-safe sticky top-0 z-30 border-b border-black bg-[linear-gradient(180deg,#1a1a20,#0c0c10)] shadow-[0_1px_0_#5c5c5c,0_4px_12px_rgb(0_0_0/0.6)]">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="wow-locker">
            <Logo size={30} />
            <span className="title-display text-lg font-semibold whitespace-nowrap text-[#ffd100] [text-shadow:0_1px_2px_#000] sm:text-xl">
              wow-locker
            </span>
          </Link>
          <span className="mt-1 hidden text-xs text-ink-faint md:inline">{t.app.tagline}</span>
          <nav className="ml-auto hidden gap-1.5 sm:flex">
            {tabs.map((tab) => (
              <Link key={tab.to} to={tab.to} className={cn("wow-btn wow-btn-sm", !tab.active && "wow-btn-dark")}>
                <tab.icon className="size-3.5" />
                {tab.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto sm:ml-2">
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 pt-5 pb-28 sm:px-4 sm:pb-10">
        <Outlet />
      </main>

      {/* Phones: navigation as the action bar — square bevelled slots. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-black bg-[linear-gradient(180deg,#1c1c22,#09090c)] shadow-[0_-1px_0_#5c5c5c] sm:hidden">
        <div className="mx-auto flex max-w-md justify-center gap-6 px-4 py-2">
          {tabs.map((tab) => (
            <Link key={tab.to} to={tab.to} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "wow-slot flex items-center justify-center",
                  tab.active && "shadow-[0_0_0_1px_#000,0_0_8px_rgb(255_209_0/0.5)] [border-color:#8a7330_#ffd100_#ffd100_#8a7330]",
                )}
              >
                <tab.icon className={cn("size-5", tab.active ? "text-[#ffd100]" : "text-ink-dim")} />
              </span>
              <span className={cn("text-[10px] font-semibold", tab.active ? "text-[#ffd100]" : "text-ink-faint")}>{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {import.meta.env.PROD && <UpdatePrompt />}
      <InstallPrompt />
    </div>
  );
}
