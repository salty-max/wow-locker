import { api } from "./probe-lib";
const NAME = "sealinedion";
const EPS = ["", "/status", "/equipment", "/specializations", "/statistics", "/character-media", "/pvp-summary", "/achievements", "/reputations", "/professions", "/titles", "/appearance"];
let realm = "soulseeker";
let s = await api(`/profile/wow/character/${realm}/${NAME}`, "profile-classic1x-eu");
if (s.status !== 200) {
  // Not on Soulseeker: try every Era/SoD and Anniversary realm.
  for (const [dyn, prof] of [["dynamic-classic1x-eu", "profile-classic1x-eu"], ["dynamic-classicann-eu", "profile-classicann-eu"]]) {
    const idx = await api("/data/wow/realm/index", dyn);
    for (const r of idx.body.realms) {
      const t = await api(`/profile/wow/character/${r.slug}/${NAME}`, prof);
      if (t.status === 200) { realm = r.slug; s = t; console.log(`found on ${r.slug} (${prof})`); break; }
    }
    if (s.status === 200) break;
  }
}
console.log("summary status", s.status);
if (s.status === 200) {
  const b = s.body;
  console.log(JSON.stringify({ name: b.name, level: b.level, race: b.race?.name, class: b.character_class?.name, faction: b.faction?.name, guild: b.guild?.name, ilvl: [b.average_item_level, b.equipped_item_level], last_login: new Date(b.last_login_timestamp).toISOString(), keys: Object.keys(b).filter((k) => k !== "_links") }, null, 1));
  for (const e of EPS.slice(1)) {
    const r = await api(`/profile/wow/character/${realm}/${NAME}${e}`, "profile-classic1x-eu");
    let note = "";
    if (r.status === 200) {
      if (e === "/status") note = JSON.stringify(r.body);
      if (e === "/equipment") note = r.body.equipped_items.map((i: any) => `${i.slot.name}: ${i.name}${i.enchantments ? " +" + i.enchantments.map((x: any) => x.display_string).join("/") : ""}`).join(" | ");
      if (e === "/specializations") note = JSON.stringify(r.body.specialization_groups?.map((g: any) => ({ active: g.is_active, trees: g.specializations?.map((t: any) => `${t.specialization_name}:${t.spent_points}`) })));
      if (e === "/statistics") note = `health ${r.body.health}, ${Object.keys(r.body).filter((k) => !k.startsWith("_")).slice(0, 12).join(",")}`;
      if (e === "/character-media") note = (r.body.assets ?? []).map((a: any) => a.key).join(",");
    }
    console.log(`${e}: ${r.status} ${note}`.slice(0, 900));
  }
}
