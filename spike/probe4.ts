import { api } from "./probe-lib";
const R = "eu";
// MoP Classic AH listing shape, for the record.
const mop = await api("/data/wow/connected-realm/4440/auctions", `dynamic-classic-${R}`);
console.log("MoP Classic listing:", JSON.stringify(mop.body.auctions[0]), "| fields:", [...new Set(mop.body.auctions.slice(0, 500).flatMap((a: any) => Object.keys(a)))].join(","));
const comm = await api("/data/wow/auctions/commodities", `dynamic-classic-${R}`);
console.log("MoP Classic commodities endpoint:", comm.status);

const ENDPOINTS = ["", "/equipment", "/specializations", "/statistics", "/character-media", "/pvp-summary", "/professions", "/achievements", "/reputations", "/titles", "/hunter-pets", "/guild"];
for (const flavour of ["classic", "classicann", "classic1x"]) {
  console.log(`\n=== ${flavour}`);
  const seasons = await api("/data/wow/pvp-season/index", `dynamic-${flavour}-${R}`);
  const season = seasons.body?.current_season?.id ?? seasons.body?.seasons?.at(-1)?.id;
  console.log(`pvp seasons: ${seasons.status} current=${season}`);
  let chars: { name: string; realm: string }[] = [];
  if (season) {
    const lbs = await api(`/data/wow/pvp-season/${season}/pvp-leaderboard/index`, `dynamic-${flavour}-${R}`);
    const lb = lbs.body?.leaderboards?.[0]?.name;
    if (lb) {
      const board = await api(`/data/wow/pvp-season/${season}/pvp-leaderboard/${lb}`, `dynamic-${flavour}-${R}`);
      chars = (board.body?.entries ?? []).slice(0, 2).map((e: any) => ({ name: e.character.name.toLowerCase(), realm: e.character.realm.slug }));
      console.log(`leaderboard ${lb}: ${board.status}, ${board.body?.entries?.length ?? 0} entries`);
    }
  }
  if (!chars.length) {
    console.log("no characters found via leaderboards");
    continue;
  }
  for (const c of chars) {
    const res: string[] = [];
    for (const e of ENDPOINTS) {
      const r = await api(`/profile/wow/character/${c.realm}/${encodeURIComponent(c.name)}${e}`, `profile-${flavour}-${R}`);
      res.push(`${e || "summary"}:${r.status}`);
      if (e === "" && r.status === 200) console.log(`  ${c.name}@${c.realm}: lvl ${r.body.level} ${r.body.character_class?.name} ilvl ${r.body.equipped_item_level ?? r.body.average_item_level ?? "?"} last_login ${r.body.last_login_timestamp ? new Date(r.body.last_login_timestamp).toISOString().slice(0, 10) : "-"}`);
      if (e === "/specializations" && r.status === 200) console.log(`  specializations keys: ${Object.keys(r.body).join(",")}; first: ${JSON.stringify(r.body.specialization_groups?.[0] ?? r.body.specializations?.[0]).slice(0, 220)}`);
      if (e === "/equipment" && r.status === 200) { const it = r.body.equipped_items?.[0]; console.log(`  equipment: ${r.body.equipped_items?.length} items; first: ${it?.name} ilvl ${it?.level?.value} enchant=${!!it?.enchantments}`); }
    }
    console.log(`  ${c.name}@${c.realm}: ${res.join(" ")}`);
  }
}
