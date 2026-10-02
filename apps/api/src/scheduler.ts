import cron from "node-cron";
import { log } from "@/lib/log";
import { runTick } from "@/lib/tick";

/**
 * In-process scheduler for the Bun server (local dev, Docker): one tick every
 * 2 minutes. On Vercel there's no long-lived process: an external cron calls
 * /api/admin/tick instead (see DEPLOY.md). Both run the same runTick().
 */
export function startScheduler(): void {
  const tick = async () => {
    try {
      // No serverless time limit here: let a tick finish what's due.
      await runTick(Infinity);
    } catch (err) {
      log.error("tick.crash", { err: String(err) });
    }
  };
  cron.schedule("*/2 * * * *", tick);
  log.info("scheduler.started", { tick: "every 2 min (each character ≤ every 10 min)" });
  void tick();
}
