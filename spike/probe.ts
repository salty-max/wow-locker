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

const NAMESPACES = [
  `dynamic-classic1x-${REGION}`, // Era / Hardcore / Anniversary / SoD
  `dynamic-classic-${REGION}`, // progression Classic
  `dynamic-forever-${REGION}`, // guess: WoW Forever
  `dynamic-${REGION}`, // retail, as a control
];

for (const ns of NAMESPACES) {
  console.log(`\n=== ${ns}`);
  const realms = await api("/data/wow/realm/index", ns);
  console.log(`realm index: ${realms.status}, ${realms.body?.realms?.length ?? 0} realms`);
  if (realms.status !== 200) continue;
  const cr = await api("/data/wow/connected-realm/index", ns);
  const ids: number[] = (cr.body?.connected_realms ?? []).map((c: { href: string }) => Number(c.href.match(/connected-realm\/(\d+)/)?.[1]));
  console.log(`connected realms: ${cr.status}, ${ids.length}`);
  // Describe each connected realm (name, category / type) — capped.
  const rows: string[] = [];
  for (const id of ids.slice(0, 40)) {
    const d = await api(`/data/wow/connected-realm/${id}`, ns);
    const names = (d.body?.realms ?? []).map((r: any) => `${r.name}${r.category ? ` [${r.category}]` : ""}${r.type?.name ? ` (${r.type.name})` : ""}`);
    rows.push(`${id}: ${names.join(", ")}`);
  }
  console.log(rows.join("\n"));
  await Bun.write(`spike/out/${ns}-connected.json`, JSON.stringify(rows, null, 2));
  // Auction house probes on the first few connected realms.
  for (const id of ids.slice(0, 3)) {
    const idx = await api(`/data/wow/connected-realm/${id}/auctions/index`, ns);
    const houses = (idx.body?.auctions ?? []).map((a: any) => `${a.id}:${a.name}`);
    console.log(`AH index ${id}: ${idx.status} ${houses.join(" ")}`);
    const flat = await api(`/data/wow/connected-realm/${id}/auctions`, ns);
    console.log(`AH flat ${id}: ${flat.status} ${flat.body?.auctions?.length ?? ""} listings, ${flat.bytes} bytes`);
    for (const h of (idx.body?.auctions ?? []).slice(0, 1)) {
      const a = await api(`/data/wow/connected-realm/${id}/auctions/${h.id}`, ns);
      const sample = a.body?.auctions?.[0];
      console.log(`AH house ${id}/${h.id}: ${a.status} ${a.body?.auctions?.length ?? 0} listings; sample fields: ${sample ? Object.keys(sample).join(",") : "-"}`);
    }
  }
}
