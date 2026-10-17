import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarClock, Download, Package, Settings } from "lucide-react";
import { useEffect, useRef } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PullToRefresh } from "@/components/PullToRefresh";
import { CharacterWatcher, Toaster } from "@/components/Toaster";
import { Logo } from "@/components/Logo";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useAccountSync } from "@/lib/account";
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
  const me = useAccountSync();
  const main = useRef<HTMLElement>(null);
  const firstPath = useRef(path);

  // A new page: move focus to its content, so a screen reader starts reading
  // there (and announces the page's title) instead of staying on the link.
  useEffect(() => {
    if (path === firstPath.current) return;
    firstPath.current = "";
    main.current?.focus({ preventScroll: true });
  }, [path]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The server pushes per device for the characters in its roster: keep its
  // copy of roster, event choices and language in sync (and tied to the
  // account while logged in).
  useEffect(() => {
    void resyncPush().catch(() => {});
  }, [lang, events, ids, me?.id]);

  const tabs = [
    { to: "/", label: t.nav.locker, icon: Package, active: path === "/" || path.startsWith("/character") },
    { to: "/today", label: t.nav.today, icon: CalendarClock, active: path === "/today" || path === "/memorial" },
    { to: "/addon", label: t.nav.addon, icon: Download, active: path === "/addon" },
    { to: "/settings", label: t.nav.settings, icon: Settings, active: path === "/settings" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col">
      <a
        href="#main"
        className="wow-btn wow-btn-sm sr-only fixed top-2 left-2 z-[70] focus:not-sr-only"
      >
        {t.nav.skip}
      </a>
      <header className="pt-safe bar-layer sticky top-0 z-30 border-b border-black bg-[linear-gradient(180deg,#1a1a20,#0c0c10)] shadow-[0_1px_0_#5c5c5c,0_4px_12px_rgb(0_0_0/0.6)]">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="WoWLocker">
            <Logo size={30} />
            <span className="title-display text-lg font-semibold whitespace-nowrap text-[#ffd100] [text-shadow:0_1px_2px_#000] sm:text-xl">
              WoWLocker
            </span>
          </Link>
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

      <main ref={main} id="main" tabIndex={-1} className="isolate flex-1 px-3 pt-9 pb-28 outline-none sm:px-4 sm:pt-10 sm:pb-10">
        <Outlet />
      </main>

      {/* Phones: the tab bar as Ravenpost's inbox and Hearthtale draw it — the
          night under a hairline, small labels, the page's tab in gold, the home
          indicator's room below it. */}
      <nav className="bar-layer fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-night/90 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-md justify-around px-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex min-w-14 flex-col items-center gap-[3px] rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                tab.active ? "text-[#ffd100]" : "text-ink-faint",
              )}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <PullToRefresh />
      {import.meta.env.PROD && <UpdatePrompt />}
      <InstallPrompt />
      <CharacterWatcher />
      <Toaster />
    </div>
  );
}
