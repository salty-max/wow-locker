// Feasibility probe: which WoW API namespaces / endpoints actually answer.
// bun spike/probe.ts   (reads .env.local; never prints credentials)
const REGION = process.env.BNET_REGION ?? "eu";
const HOST = `https://${REGION}.api.blizzard.com`;

async function token(): Promise<string> {
  const auth = btoa(`${process.env.BNET_CLIENT_ID}:${process.env.BNET_CLIENT_SECRET}`);
  const r = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return ((await r.json()) as { access_token: string }).access_token;
}
const TOKEN = await token();

export async function api(path: string, namespace: string): Promise<{ status: number; body: any; bytes: number }> {
  const url = `${HOST}${path}${path.includes("?") ? "&" : "?"}namespace=${namespace}&locale=en_GB`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await r.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return { status: r.status, body, bytes: text.length };
}

