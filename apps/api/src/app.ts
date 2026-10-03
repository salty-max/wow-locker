import type { AddCharacterRequest, SubscribeRequest } from "@wow-locker/shared";
import { FLAVOURS, isHardcoreRealm, NOTIFIABLE_EVENTS, REGIONS, type EventType, type Flavour, type Region } from "@wow-locker/shared";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AccountRow } from "@/db/schema";
import {
  cleanRoster,
  deleteAccount,
  endSession,
  meOf,
  saveRoster,
  saveSettings,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  sessionAccount,
  setShared,
} from "@/lib/accounts";
import { appOrigin, finishLogin, getImport, startLogin } from "@/lib/account";
import { authorizeCron } from "@/lib/auth";
import { runTick } from "@/lib/tick";
import { handleUpload, pairingExists, pollPairing, startPairing } from "@/lib/companion";
import { BnetError } from "@/lib/bnet";
import { itemTooltip } from "@/lib/items";
import { log } from "@/lib/log";
import { asLang, DEFAULT_LANG } from "@/lib/notify";
import { isAllowedPushEndpoint, removeSubscription, saveSubscription, sendWelcome, vapidPublicKey } from "@/lib/push";
import { listRealms } from "@/lib/realms";
import { ogPage } from "@/lib/og";
import { addCharacter, getCharacter, getCharacters, getMemorial, InputError, NotFoundError, refreshDue, searchItems } from "@/lib/tracker";

type Env = { Variables: { account: AccountRow | null } };
export const app = new Hono<Env>();

// Who's asking: the logged-in account, from the session cookie (null: a guest).
app.use("/api/*", async (c, next) => {
  c.set("account", await sessionAccount(getCookie(c, SESSION_COOKIE)));
  await next();
});
const viewer = (c: Context<Env>) => {
  const a = c.get("account");
  return a ? { accountId: a.id } : null;
};
/**
 * Account writes: the cookie is SameSite=Lax (no cross-site POST carries it)
 * and, belt and braces, a browser's Origin must be ours.
 */
const sameOrigin = (c: Context<Env>) => {
  const origin = c.req.header("origin");
  return !origin || origin === appOrigin();
};
const sessionCookie = (c: Context<Env>, token: string) =>
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: appOrigin().startsWith("https:"),
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

app.onError((err, c) => {
  if (err instanceof InputError) return c.json({ error: err.message }, 400);
  if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
  log.error("http.error", { path: c.req.path, err: String(err) });
  if (err instanceof BnetError) return c.json({ error: "Battle.net is not answering right now" }, 502);
  return c.json({ error: "internal error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/realms", async (c) => {
  const region = (c.req.query("region") ?? "eu") as Region;
  if (!REGIONS.includes(region)) return c.json({ error: "bad region" }, 400);
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(await listRealms(region));
});

const ids = (v: string | undefined) =>
  [...new Set((v ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);

app.get("/api/characters", async (c) => c.json(await getCharacters(ids(c.req.query("ids")), viewer(c))));

app.post("/api/characters", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<AddCharacterRequest> | null;
  if (!body || typeof body.realm !== "string" || typeof body.name !== "string") throw new InputError("realm and name required");
  return c.json(await addCharacter(body as AddCharacterRequest), 201);
});

// An item's tooltip (bags, bank): /api/item-tooltip/eu/classic1x/5195. Items
// never change, so the CDN may keep the answer for a long time.
app.get("/api/item-tooltip/:region/:flavour/:id", async (c) => {
  const region = c.req.param("region") as Region;
  const flavour = c.req.param("flavour") as Flavour;
  const id = Number(c.req.param("id"));
  if (!REGIONS.includes(region) || !FLAVOURS.includes(flavour) || !Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return c.json({ error: "bad item" }, 400);
  }
  const tooltip = await itemTooltip(region, flavour, id);
  c.header("Cache-Control", "public, max-age=86400, s-maxage=2592000");
  return c.json({ tooltip });
});

// An item across a device's characters: /api/items?ids=1,2&q=linen
app.get("/api/items", async (c) => c.json(await searchItems(ids(c.req.query("ids")), c.req.query("q") ?? "", viewer(c))));

// The fallen of a roster and its dangers: /api/memorial?ids=1,2
app.get("/api/memorial", async (c) => c.json(await getMemorial(ids(c.req.query("ids")), viewer(c))));

// Link previews: crawlers (Discord, Slack…) asking for a character page are
// routed to this function by user agent (scripts/vercel-build.sh), with the
// path unchanged; /api/og/… is the same page, for testing. Cached briefly: a
// preview should follow the level.
const preview = async (c: Context<Env>) => {
  const id = Number(c.req.param("id"));
  const ch = Number.isInteger(id) && id > 0 ? await getCharacter(id, { touch: false }) : null;
  if (!ch) return c.redirect("/");
  const death = ch.events.find((e) => e.data.type === "death" && e.source === "addon") ?? ch.events.find((e) => e.data.type === "death");
  const html = ogPage(
    {
      c: ch,
      hardcore: ch.addon?.hardcore ?? isHardcoreRealm({ region: ch.region, slug: ch.realmSlug }),
      playedTotal: ch.addon?.playedTotal ?? null,
      death: death?.data.type === "death" ? death.data : null,
    },
    appOrigin(),
  );
  c.header("Cache-Control", "public, max-age=600, s-maxage=600");
  return c.html(html);
};
app.get("/character/:id", preview);
app.get("/api/og/character/:id", preview);

app.get("/api/characters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "bad id" }, 400);
  const ch = await getCharacter(id, { viewer: viewer(c) });
  return ch ? c.json(ch) : c.json({ error: "not found" }, 404);
});

// The owner opens (or closes) a character's private details to anyone.
app.put("/api/characters/:id/sharing", async (c) => {
  const a = c.get("account");
  if (!a || !sameOrigin(c)) return c.json({ error: "unauthorized" }, 401);
  const b = (await c.req.json().catch(() => null)) as { shared?: unknown } | null;
  if (typeof b?.shared !== "boolean") return c.json({ error: "bad request" }, 400);
  const ok = await setShared(a, Number(c.req.param("id")), b.shared);
  return ok ? c.json({ shared: b.shared }) : c.json({ error: "not yours" }, 403);
});

// ── account ──────────────────────────────────────────────────────────────────

app.get("/api/me", (c) => {
  const a = c.get("account");
  c.header("Cache-Control", "no-store");
  return c.json(a ? meOf(a) : null);
});

app.put("/api/me/roster", async (c) => {
  const a = c.get("account");
  if (!a || !sameOrigin(c)) return c.json({ error: "unauthorized" }, 401);
  const roster = await cleanRoster(((await c.req.json().catch(() => null)) as { ids?: unknown } | null)?.ids);
  if (!roster) return c.json({ error: "bad request" }, 400);
  return c.json(meOf(await saveRoster(a, roster)));
});

app.put("/api/me/settings", async (c) => {
  const a = c.get("account");
  if (!a || !sameOrigin(c)) return c.json({ error: "unauthorized" }, 401);
  const b = (await c.req.json().catch(() => null)) as { lang?: unknown; events?: unknown } | null;
  return c.json(meOf(await saveSettings(a, b ?? {})));
});

app.post("/api/me/logout", async (c) => {
  if (!sameOrigin(c)) return c.json({ error: "unauthorized" }, 401);
  await endSession(getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.delete("/api/me", async (c) => {
  const a = c.get("account");
  if (!a || !sameOrigin(c)) return c.json({ error: "unauthorized" }, 401);
  await deleteAccount(a);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ── Log in with Battle.net (account import) ─────────────────────────────────

app.get("/api/auth/login", async (c) => {
  const region = (c.req.query("region") ?? "eu") as Region;
  if (!REGIONS.includes(region)) return c.json({ error: "bad region" }, 400);
  // ?pair=CODE: this login also pairs a companion app.
  const pair = c.req.query("pair");
  if (pair && !(await pairingExists(pair))) return c.redirect(`${appOrigin()}/pair?code=${encodeURIComponent(pair)}&error=expired`);
  return c.redirect(await startLogin(region, pair || undefined));
});

app.get("/api/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  // Blizzard sends ?error=access_denied when the user cancels.
  if (!code || !state) return c.redirect(`${appOrigin()}/import?error=${encodeURIComponent(c.req.query("error") ?? "cancelled")}`);
  try {
    const { importKey, pairCode, pairExpired, session } = await finishLogin(code, state);
    if (session) sessionCookie(c, session);
    if (pairExpired) return c.redirect(`${appOrigin()}/pair?code=${encodeURIComponent(pairExpired)}&error=expired`);
    return c.redirect(
      pairCode ? `${appOrigin()}/pair?code=${encodeURIComponent(pairCode)}&done=1&k=${importKey}` : `${appOrigin()}/import?k=${importKey}`,
    );
  } catch (err) {
    log.warn("auth.callback.failed", { err: String(err) });
    return c.redirect(`${appOrigin()}/import?error=failed`);
  }
});

app.get("/api/auth/import/:k", async (c) => {
  const data = await getImport(c.req.param("k"));
  return data ? c.json(data) : c.json({ error: "expired" }, 404);
});

// ── companion app ────────────────────────────────────────────────────────────

app.post("/api/companion/pair/start", async (c) => c.json(await startPairing(appOrigin())));

app.get("/api/companion/pair/:code", async (c) => c.json({ pending: await pairingExists(c.req.param("code")) }));

app.post("/api/companion/pair/poll", async (c) => {
  const b = (await c.req.json().catch(() => null)) as { code?: unknown; pollToken?: unknown } | null;
  if (typeof b?.code !== "string" || typeof b.pollToken !== "string") return c.json({ error: "bad request" }, 400);
  return c.json(await pollPairing(b.code, b.pollToken));
});

app.post(
  "/api/companion/upload",
  // A whole SavedVariables file, as JSON: ~1 MB for 5000 events. 4 MB keeps
  // under Vercel's 4.5 MB request limit.
  bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => c.json({ error: "upload too large" }, 413) }),
  async (c) => {
    const auth = c.req.header("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "bad request" }, 400);
    const result = await handleUpload(token, body);
    return result ? c.json(result) : c.json({ error: "unknown or revoked companion" }, 401);
  },
);

// ── push ─────────────────────────────────────────────────────────────────────

app.get("/api/push/key", (c) => c.json({ key: vapidPublicKey() }));

app.post("/api/push/subscribe", async (c) => {
  const b = (await c.req.json().catch(() => null)) as Partial<SubscribeRequest> | null;
  const sub = b?.subscription;
  const events = Array.isArray(b?.events) ? b.events.filter((e): e is EventType => NOTIFIABLE_EVENTS.includes(e as EventType)) : null;
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string" ||
    !isAllowedPushEndpoint(sub.endpoint) ||
    typeof b?.deviceId !== "string" ||
    !events
  ) {
    return c.json({ error: "bad subscription" }, 400);
  }
  const lang = asLang(b.lang) ?? DEFAULT_LANG;
  await saveSubscription(sub, b.deviceId.slice(0, 64), ids((b.characterIds ?? []).join(",")), events, lang, c.get("account")?.id ?? null);
  const welcomed = b.welcome ? await sendWelcome(sub, lang) : false;
  return c.json({ ok: true, welcomed });
});

app.post("/api/push/unsubscribe", async (c) => {
  const b = (await c.req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof b?.endpoint !== "string") return c.json({ error: "bad request" }, 400);
  await removeSubscription(b.endpoint);
  return c.json({ ok: true });
});

// ── admin (Bearer CRON_SECRET) ───────────────────────────────────────────────

app.use("/api/admin/*", async (c, next) => {
  if (!authorizeCron(c.req.raw)) return c.json({ error: "unauthorized" }, 401);
  await next();
});
app.post("/api/admin/refresh", async (c) => c.json(await refreshDue(200)));
// The scheduler, for hosts without a long-lived process: call every 2 minutes.
app.on(["GET", "POST"], "/api/admin/tick", async (c) => c.json(await runTick()));
