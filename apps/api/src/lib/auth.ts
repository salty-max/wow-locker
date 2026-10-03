import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Guards /api/admin/*: requires `Authorization: Bearer ${CRON_SECRET}`.
 * Fails closed when CRON_SECRET is unset. Compared as hashes in constant
 * time, so the response time says nothing about the secret.
 */
const digest = (s: string) => createHash("sha256").update(s).digest();

export function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
