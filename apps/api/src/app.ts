import type { AddCharacterRequest, SubscribeRequest } from "@wow-locker/shared";
import { NOTIFIABLE_EVENTS, REGIONS, type EventType, type Region } from "@wow-locker/shared";
import { Hono } from "hono";
import { appOrigin, finishLogin, getImport, startLogin } from "@/lib/account";
import { authorizeCron } from "@/lib/auth";
import { BnetError } from "@/lib/bnet";
import { log } from "@/lib/log";
import { asLang, DEFAULT_LANG } from "@/lib/notify";
import { isAllowedPushEndpoint, removeSubscription, saveSubscription, sendWelcome, vapidPublicKey } from "@/lib/push";
import { listRealms } from "@/lib/realms";
import { addCharacter, getCharacter, getCharacters, InputError, NotFoundError, refreshDue } from "@/lib/tracker";

export const app = new Hono();

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

app.get("/api/characters", async (c) => c.json(await getCharacters(ids(c.req.query("ids")))));

app.post("/api/characters", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<AddCharacterRequest> | null;
  if (!body || typeof body.realm !== "string" || typeof body.name !== "string") throw new InputError("realm and name required");
  return c.json(await addCharacter(body as AddCharacterRequest), 201);
});

app.get("/api/characters/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "bad id" }, 400);
  const ch = await getCharacter(id);
  return ch ? c.json(ch) : c.json({ error: "not found" }, 404);
});

// ── Log in with Battle.net (account import) ─────────────────────────────────

app.get("/api/auth/login", (c) => {
  const region = (c.req.query("region") ?? "eu") as Region;
  if (!REGIONS.includes(region)) return c.json({ error: "bad region" }, 400);
  return c.redirect(startLogin(region));
});

app.get("/api/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  // Blizzard sends ?error=access_denied when the user cancels.
  if (!code || !state) return c.redirect(`${appOrigin()}/import?error=${encodeURIComponent(c.req.query("error") ?? "cancelled")}`);
  try {
    const k = await finishLogin(code, state);
    return c.redirect(`${appOrigin()}/import?k=${k}`);
  } catch (err) {
    log.warn("auth.callback.failed", { err: String(err) });
    return c.redirect(`${appOrigin()}/import?error=failed`);
  }
});

app.get("/api/auth/import/:k", (c) => {
  const data = getImport(c.req.param("k"));
  return data ? c.json(data) : c.json({ error: "expired" }, 404);
});

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
  await saveSubscription(sub, b.deviceId.slice(0, 64), ids((b.characterIds ?? []).join(",")), events, lang);
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
