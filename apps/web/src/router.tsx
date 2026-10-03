import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { Addon } from "@/routes/Addon";
import { Character } from "@/routes/Character";
import { Import } from "@/routes/Import";
import { Pair } from "@/routes/Pair";
import { Locker } from "@/routes/Locker";
import { Memorial } from "@/routes/Memorial";
import { Privacy } from "@/routes/Privacy";
import { Settings } from "@/routes/Settings";
import { Today } from "@/routes/Today";

const rootRoute = createRootRoute({ component: Layout });
const lockerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Locker });
const characterRoute = createRoute({ getParentRoute: () => rootRoute, path: "/character/$id", component: Character });
const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  validateSearch: (s: Record<string, unknown>): { k?: string; error?: string } => ({
    k: typeof s.k === "string" ? s.k : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: Import,
});
const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pair",
  validateSearch: (s: Record<string, unknown>): { code?: string; done?: boolean; error?: string; k?: string } => ({
    code: typeof s.code === "string" ? s.code : undefined,
    done: s.done === 1 || s.done === "1" || s.done === true ? true : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    k: typeof s.k === "string" ? s.k : undefined,
  }),
  component: Pair,
});
const addonRoute = createRoute({ getParentRoute: () => rootRoute, path: "/addon", component: Addon });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: Settings });
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/privacy", component: Privacy });
const todayRoute = createRoute({ getParentRoute: () => rootRoute, path: "/today", component: Today });
const memorialRoute = createRoute({ getParentRoute: () => rootRoute, path: "/memorial", component: Memorial });

const routeTree = rootRoute.addChildren([lockerRoute, characterRoute, todayRoute, memorialRoute, privacyRoute, importRoute, pairRoute, addonRoute, settingsRoute]);

export const router = createRouter({ routeTree, scrollRestoration: true, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
