import { getRequestListener } from "@hono/node-server";
import { app } from "@/app";
import { initDb } from "@/db/local";
import { credentials } from "@/lib/bnet";
import { log, setLogFormat, setLogLevel } from "@/lib/log";

// Vercel entry: the whole API as one Node.js function (bundled by
// scripts/vercel-build.sh). The web app is served by Vercel's CDN, and the
// scheduler runs from an external cron calling /api/admin/tick.

initDb();
setLogLevel(process.env.LOG_LEVEL);
setLogFormat(process.env.LOG_FORMAT ?? "json");
if (!credentials()) log.warn("bnet.credentials.missing", { hint: "set BNET_CLIENT_ID / BNET_CLIENT_SECRET" });

export default getRequestListener(app.fetch);
