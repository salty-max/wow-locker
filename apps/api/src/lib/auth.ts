/**
 * Guards /api/admin/*: requires `Authorization: Bearer ${CRON_SECRET}`.
 * Fails closed when CRON_SECRET is unset.
 */
export function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
