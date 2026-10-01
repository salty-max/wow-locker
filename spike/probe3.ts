import { api } from "./probe-lib";
const NS = "dynamic-classicann-eu";
const cr = await api("/data/wow/connected-realm/index", NS);
const ids: number[] = cr.body.connected_realms.map((c: { href: string }) => Number(c.href.match(/connected-realm\/(\d+)/)![1]));
for (const id of ids) {
  const d = await api(`/data/wow/connected-realm/${id}`, NS);
  const names = d.body.realms.map((r: any) => `${r.name} [${r.category}] (${r.type?.name}) slug=${r.slug}`).join(", ");
  const idx = await api(`/data/wow/connected-realm/${id}/auctions/index`, NS);
  const houses = (idx.body?.auctions ?? []).map((a: any) => a.id);
  const res: string[] = [];
  for (const h of houses.length ? houses : [0]) {
    const a = await api(`/data/wow/connected-realm/${id}/auctions${h ? `/${h}` : ""}`, NS);
    const s = a.body?.auctions?.[0];
    res.push(`${h}:${a.status}${a.status === 200 ? ` ${a.body.auctions.length} listings` : ""}`);
    if (s && !globalThis.__shown) { (globalThis as any).__shown = 1; console.log("sample listing:", JSON.stringify(s)); }
  }
  console.log(`${id}: ${names}\n   AH index ${idx.status} → ${res.join(" | ")}`);
}
