import { serveStatic } from "hono/bun";
import { app } from "@/app";
import { initDb } from "@/db/local";
import { credentials } from "@/lib/bnet";
import { log, setLogFormat, setLogLevel } from "@/lib/log";
import { startScheduler } from "@/scheduler";

// Bun entry. Bun auto-loads .env/.env.local (BNET_CLIENT_ID/SECRET, VAPID_*…).

initDb();
setLogLevel(process.env.LOG_LEVEL);
setLogFormat(process.env.LOG_FORMAT ?? "pretty");

app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("*", serveStatic({ path: "../web/dist/index.html" }));

if (!credentials()) log.warn("bnet.credentials.missing", { hint: "set BNET_CLIENT_ID / BNET_CLIENT_SECRET" });
if (process.env.SCHEDULER !== "off") startScheduler();

const port = Number(process.env.PORT ?? 3000);
console.log(`WoWLocker API → http://localhost:${port}`);

export default { port, fetch: app.fetch };
