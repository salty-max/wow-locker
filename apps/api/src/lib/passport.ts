import { createPublicKey, verify } from "node:crypto";

/**
 * A passport from Ravenpost's inbox (salty-max/ravenpost, inbox/): who signed
 * in with Battle.net there, and the Classic Era characters it lists, signed
 * with the inbox's Ed25519 key; ten minutes, once. Only the public key is
 * here: it checks a passport, it can't make one. Same keys as Hearthtale's.
 */
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAAog81ED5lbPfcqS53IWB3ON5z1j5wu1TeUoefrEUFlQ=
-----END PUBLIC KEY-----`;
// (the inbox's key for this computer only, INBOX_DEV: never trusted on Vercel)
const DEV_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAgiDVP8BHwyQ9D6WYy8rla/Ih/n67iDY66l0WEMqCv1M=
-----END PUBLIC KEY-----`;

/** `characters`: [id, realm slug, name] of the same characters, when the inbox sent them. */
export type PassportOwned = { region: string; ids: number[]; characters?: [number, string, string][] };
export type Passport = { aud: string; bnetId: number; battletag: string; owned: PassportOwned[]; iat: number; exp: number; jti: string };

const keys = () => [PUBLIC_KEY, ...(process.env.VERCEL ? [] : [DEV_PUBLIC_KEY])].map((k) => createPublicKey(k));

/** The passport, if a key of the inbox signed it, it is for the sites and still fresh. */
export function readPassport(passport: unknown): Passport | null {
  if (typeof passport !== "string" || passport.length > 100_000) return null;
  const [body, sig] = passport.split(".");
  if (!body || !sig) return null;
  const signed = keys().some((k) => {
    try {
      return verify(null, Buffer.from(body), k, Buffer.from(sig, "base64url"));
    } catch {
      return false;
    }
  });
  if (!signed) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Passport;
    const fresh = typeof p.exp === "number" && p.exp > Date.now() / 1000;
    const shaped = p.aud === "sites" && Number.isSafeInteger(p.bnetId) && typeof p.jti === "string" && Array.isArray(p.owned);
    return fresh && shaped ? p : null;
  } catch {
    return null;
  }
}
