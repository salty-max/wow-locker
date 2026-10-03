import { fireReminders } from "@/lib/companion";
import { acquireLease, releaseLease, sweepTemp } from "@/lib/ephemeral";
import { log } from "@/lib/log";
import { setState } from "@/lib/state";
import { notifyPending, pushSessionRecaps, refreshDue } from "@/lib/tracker";

/**
 * One scheduler tick: refresh the characters that are due (each at most every
 * 10 min), retry failed pushes, push session recaps, fire due reminders, drop expired temp rows.
 *
 * Called every 2 minutes, either by the in-process scheduler (Bun server) or
 * by an external cron hitting /api/admin/tick (serverless). The lease keeps
 * two ticks from running at once, wherever they come from; the time budget
 * keeps a tick inside a serverless function's time limit.
 */
const LEASE = "tick";
const LEASE_MS = 5 * 60_000; // a crashed tick frees the lease after this
export const TICK_BUDGET_MS = 45_000;

export type TickResult = { ran: boolean; checked: number; pushed: number; reminders: number; swept: number; ms: number };

export async function runTick(budgetMs = TICK_BUDGET_MS): Promise<TickResult> {
  const started = Date.now();
  if (!(await acquireLease(LEASE, LEASE_MS))) {
    log.info("tick.skipped", { reason: "another tick is running" });
    return { ran: false, checked: 0, pushed: 0, reminders: 0, swept: 0, ms: 0 };
  }
  try {
    const deadline = started + budgetMs;
    const r = await refreshDue(60, deadline);
    const { fired: retried } = await notifyPending();
    const { fired: recaps } = await pushSessionRecaps();
    const pushed = retried + recaps;
    const { fired: reminders } = await fireReminders();
    const swept = await sweepTemp();
    if (r.checked) await setState("lastRefreshAt", new Date().toISOString());
    const result = { ran: true, checked: r.checked, pushed, reminders, swept, ms: Date.now() - started };
    if (r.checked || pushed || reminders) log.info("tick", result);
    return result;
  } finally {
    await releaseLease(LEASE);
  }
}
