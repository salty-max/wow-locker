import type { EventData, EventType, Lang } from "@wow-locker/shared";
import { and, arrayContains, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts, pushSubscription, type CharacterRow, type SubscriptionRow } from "@/db/schema";
import { log } from "@/lib/log";
import { asLang, DEFAULT_LANG, renderEvent, renderWelcome, type Rendered } from "@/lib/notify";
import { sendPush, type PushSub, type Vapid } from "@/lib/webpush";

export function getVapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

/** /api/push/subscribe is unauthenticated: only real push services may be stored. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  ".push.apple.com",
  "updates.push.services.mozilla.com",
  ".notify.windows.com",
  ".push.microsoft.com",
];
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
  } catch {
    return false;
  }
}

export async function saveSubscription(
  sub: PushSub,
  deviceId: string,
  characterIds: number[],
  events: EventType[],
  lang: Lang,
  accountId: number | null = null,
): Promise<void> {
  const row = { p256dh: sub.keys.p256dh, auth: sub.keys.auth, deviceId, characterIds, events, lang, accountId };
  await db
    .insert(pushSubscription)
    .values({ endpoint: sub.endpoint, ...row })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: row });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, [endpoint]));
}

/** A character's news stays relevant for a day; a death for longer. */
const ttlFor = (e: EventData) => (e.type === "death" ? 3 * 86400 : 86400);

async function send(s: SubscriptionRow, r: Rendered, url: string, tag: string, ttl: number, vapid: Vapid) {
  try {
    const res = await sendPush(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      { title: r.title, body: r.body, url, tag },
      vapid,
      { ttl, urgency: "normal" },
    );
    if (res.ok) return "ok" as const;
    if (res.gone) return "gone" as const;
    log.warn("push.send.failed", { status: res.status });
  } catch (err) {
    log.warn("push.send.error", { err: String(err) });
  }
  return "failed" as const;
}

export async function sendWelcome(sub: PushSub, lang: Lang): Promise<boolean> {
  const vapid = getVapid();
  if (!vapid) return false;
  const row = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth } as SubscriptionRow;
  return (await send(row, renderWelcome(lang), "/", "welcome", 60, vapid)) === "ok";
}

export type DeliveryResult = { sent: number; targets: number };

/** Reminders (mail, crafts) and session recaps (gold) are the owner's business. */
const PERSONAL = new Set<EventType>(["reminder", "session"]);

/**
 * Push one event to every device tracking this character that wants this kind
 * of event. A device subscribed while logged in follows its account's roster,
 * choices and language; a guest device, its own. An owned, unshared
 * character's personal events reach its owner's devices only.
 */
export async function deliverEvent(
  character: Pick<CharacterRow, "id" | "name" | "ownerId" | "shared">,
  event: { id: number; data: EventData },
): Promise<DeliveryResult> {
  const vapid = getVapid();
  if (!vapid) return { sent: 0, targets: 0 };
  const rows = await db
    .select({ s: pushSubscription, a: accounts })
    .from(pushSubscription)
    .leftJoin(accounts, eq(accounts.id, pushSubscription.accountId))
    .where(
      or(
        and(isNull(pushSubscription.accountId), arrayContains(pushSubscription.characterIds, [character.id])),
        arrayContains(accounts.roster, [character.id]),
      ),
    );
  const personal = PERSONAL.has(event.data.type) && character.ownerId != null && !character.shared;
  const targets = rows
    .filter(({ s, a }) => (a?.events ?? s.events).includes(event.data.type))
    .filter(({ a }) => !personal || a?.id === character.ownerId);
  let sent = 0;
  const dead: string[] = [];
  for (const { s, a } of targets) {
    const r = renderEvent(character.name, event.data, asLang(a?.lang ?? s.lang) ?? DEFAULT_LANG);
    const res = await send(s, r, `/character/${character.id}`, `e${event.id}`, ttlFor(event.data), vapid);
    if (res === "ok") sent++;
    else if (res === "gone") dead.push(s.endpoint);
  }
  if (dead.length) await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, dead));
  return { sent, targets: targets.length - dead.length };
}
