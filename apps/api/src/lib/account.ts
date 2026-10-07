import type { AccountCharacter, AccountImport, Flavour, Region } from "@wow-locker/shared";
import { FLAVOURS, REGIONS } from "@wow-locker/shared";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { accountProfile, api, authorizeUrl, BnetError, exchangeCode, userInfo } from "@/lib/bnet";
import { classKeyOf, factionOf } from "@/lib/classic";
import { waitUntil } from "@vercel/functions";
import { createSession, loginAccount } from "@/lib/accounts";
import { completePairing } from "@/lib/companion";
import { getTemp, putTemp, setTemp, takeTemp } from "@/lib/ephemeral";
import { log } from "@/lib/log";
import { listRealms } from "@/lib/realms";

/**
 * "Log in with Battle.net": opens a WoWLocker session (accounts.ts) and offers
 * to import the account's characters.
 *
 * The access token is used once, right in the callback, to read who the user
 * is and their character list, then dropped. The list waits a few minutes
 * under a random key (in the ephemeral table: any server instance can answer)
 * so the web app can show the import screen.
 */

const TTL_MS = 10 * 60_000;
type PendingLogin = { region: Region; pairCode?: string };

const randomKey = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");

/** Where Blizzard sends the user back. Must be registered on develop.battle.net. */
export function redirectUri(): string {
  const origin = (process.env.APP_ORIGIN ?? "http://localhost:5174").replace(/\/$/, "");
  return `${origin}/api/auth/callback`;
}

export function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? "http://localhost:5174").replace(/\/$/, "");
}

/** `pairCode`: this login also pairs a companion app (see companion.ts). */
export async function startLogin(region: Region, pairCode?: string): Promise<string> {
  if (!REGIONS.includes(region)) throw new Error("bad region");
  const state = randomKey();
  await putTemp("login", state, { region, pairCode } satisfies PendingLogin, TTL_MS);
  return authorizeUrl(redirectUri(), state);
}

/** Handle Blizzard's redirect. Returns where to send the browser, or throws. */
export async function finishLogin(
  code: string,
  state: string,
): Promise<{ importKey: string; pairCode?: string; pairExpired?: string; session: string | null }> {
  const pending = await takeTemp<PendingLogin>("login", state); // one use
  if (!pending) throw new Error("unknown or expired login state");
  const token = await exchangeCode(code, redirectUri());
  const [{ id: bnetId, battletag }, realms] = await Promise.all([
    userInfo(token).catch(() => ({ id: undefined, battletag: undefined })),
    listRealms(pending.region),
  ]);
  const category = new Map(realms.map((r) => [`${r.flavour}:${r.slug}`, r.category]));

  const found: (Omit<AccountCharacter, "trackedId" | "isGhost" | "isSelfFound"> & { id: number })[] = [];
  const unavailable: Flavour[] = [];
  for (const flavour of FLAVOURS) {
    try {
      const profile = await accountProfile(flavour, pending.region, token);
      for (const acc of profile.wow_accounts ?? []) {
        for (const c of acc.characters ?? []) {
          found.push({
            id: c.id,
            region: pending.region,
            flavour,
            realmSlug: c.realm.slug,
            realmName: c.realm.name,
            realmCategory: category.get(`${flavour}:${c.realm.slug}`) ?? "",
            name: c.name,
            level: c.level,
            className: c.playable_class.name,
            classKey: classKeyOf(c.playable_class.id),
            faction: factionOf(c.faction.type),
          });
        }
      }
    } catch (err) {
      // A flavour the account never played answers 404; anything else is a gap.
      if (!(err instanceof BnetError && err.status === 404)) unavailable.push(flavour);
      log.info("account.flavour", { flavour, status: err instanceof BnetError ? err.status : String(err) });
    }
  }

  const tracked = await trackedIds(pending.region, found);
  const data: AccountImport = {
    region: pending.region,
    battletag: battletag ?? null,
    characters: found
      .map(({ id: _id, ...c }) => ({ ...c, isGhost: null, isSelfFound: null, trackedId: tracked.get(key(c)) ?? null }))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
    unavailable,
    checking: found.length > 0,
  };
  const k = randomKey();
  await putTemp("import", k, data, TTL_MS);
  // The account list has no dead/alive flag: read each profile in the
  // background (1 request each) while the import screen is already showing.
  // waitUntil keeps a serverless function alive until it's done.
  waitUntil(checkStatuses(k, data).catch((err) => log.warn("account.check.failed", { err: String(err) })));
  log.info("account.imported", { region: pending.region, characters: data.characters.length, unavailable });
  // The account, and a session for this browser (no id: Blizzard didn't say who, no account).
  // A flavour that didn't answer leaves its characters out of `owned` until the next login.
  const acc = bnetId ? await loginAccount({ bnetId, battletag: battletag ?? null, region: pending.region, owned: found.map((c) => c.id), unavailable }) : null;
  const session = acc ? await createSession(acc.id) : null;
  let pairCode = pending.pairCode;
  if (pairCode) {
    const paired = await completePairing(pairCode, {
      region: pending.region,
      battletag: battletag ?? null,
      owned: found.map((c) => ({ id: c.id, flavour: c.flavour, realmSlug: c.realmSlug, name: c.name })),
      unavailable,
      accountId: acc?.id ?? null,
    });
    if (!paired) pairCode = undefined;
  }
  return { importKey: k, pairCode, pairExpired: !!pending.pairCode && !pairCode ? pending.pairCode : undefined, session };
}

/** Progress is saved every few characters, so the import screen fills in live. */
async function checkStatuses(k: string, data: AccountImport): Promise<void> {
  // Highest levels first: the ones the user is most likely to pick.
  let lastSave = Date.now();
  for (const c of data.characters) {
    try {
      const p = await api.summary(c.flavour, c.region, c.realmSlug, c.name);
      c.isGhost = p.is_ghost === true;
      c.isSelfFound = p.is_self_found === true;
    } catch {
      /* unknown: left null */
    }
    if (Date.now() - lastSave > 1500) {
      if (!(await setTemp("import", k, data))) return; // expired: nobody's looking
      lastSave = Date.now();
    }
  }
  data.checking = false;
  await setTemp("import", k, data);
}

export async function getImport(k: string): Promise<AccountImport | null> {
  return getTemp<AccountImport>("import", k);
}

const key = (c: { flavour: Flavour; realmSlug: string; name: string }) => `${c.flavour}:${c.realmSlug}:${c.name.toLowerCase()}`;

async function trackedIds(region: Region, list: { flavour: Flavour; realmSlug: string; name: string }[]) {
  const map = new Map<string, number>();
  if (!list.length) return map;
  const rows = await db
    .select({ id: characters.id, flavour: characters.flavour, realmSlug: characters.realmSlug, nameKey: characters.nameKey })
    .from(characters)
    .where(and(eq(characters.region, region), inArray(characters.nameKey, list.map((c) => c.name.toLowerCase()))));
  for (const r of rows) map.set(`${r.flavour}:${r.realmSlug}:${r.nameKey}`, r.id);
  return map;
}
