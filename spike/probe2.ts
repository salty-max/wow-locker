import { api } from "./probe-lib";
const R = "eu";
// 1) Every classic1x connected realm: does any auction house answer?
const cr = await api("/data/wow/connected-realm/index", `dynamic-classic1x-${R}`);
const ids: number[] = cr.body.connected_realms.map((c: { href: string }) => Number(c.href.match(/connected-realm\/(\d+)/)![1]));
let ok = 0;
const fails: string[] = [];
for (const id of ids) {
  for (const house of [2, 6, 7]) {
    const a = await api(`/data/wow/connected-realm/${id}/auctions/${house}`, `dynamic-classic1x-${R}`);
    if (a.status === 200) ok++;
    else fails.push(`${id}/${house}:${a.status}`);
  }
}
console.log(`classic1x AH: ${ok} ok, ${fails.length} failing (${[...new Set(fails.map((f) => f.split(":")[1]))].join(",")})`);
// 2) Namespace guesses for TBC Anniversary + Forever, vs a nonsense control.
const guesses = [
  "classicann", "classic-anniversary", "classictbc", "classic-tbc", "tbc", "classic2x", "classic3x",
  "classic1x-ann", "anniversary", "forever", "wowforever", "classic-forever", "fever", "zzz-nonsense",
];
for (const g of guesses) {
  const r = await api("/data/wow/realm/index", `dynamic-${g}-${R}`);
  console.log(`dynamic-${g}-${R}: ${r.status} ${r.body?.realms ? r.body.realms.length + " realms" : ""}`);
}
