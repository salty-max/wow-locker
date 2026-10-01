import cron from "node-cron";
import { log } from "@/lib/log";
import { setState } from "@/lib/state";
import { notifyPending, refreshDue } from "@/lib/tracker";

function guarded(name: string, job: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      log.error(`${name}.crash`, { err: String(err) });
    } finally {
      running = false;
    }
  };
}

/**
 * In-process scheduler: every 2 minutes, refresh the characters that are due
 * (each one at most every 10 min; 1 request when nothing changed), then retry
 * any push that failed.
 */
export function startScheduler(): void {
  const tick = guarded("refresh", async () => {
    const r = await refreshDue();
    await notifyPending();
    if (r.checked) await setState("lastRefreshAt", new Date().toISOString());
  });
  cron.schedule("*/2 * * * *", tick);
  log.info("scheduler.started", { refresh: "every 2 min (each character ≤ every 10 min)" });
  void tick();
}
