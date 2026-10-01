import { api } from "./probe-lib";
const base = "/profile/wow/character/soulseeker/sealinedion";
for (const e of ["", "/equipment", "/specializations", "/statistics", "/character-media"]) {
  const r = await api(base + e, "profile-classic1x-eu");
  await Bun.write(`apps/api/src/lib/__fixtures__/sealinedion${e.replace("/", "-") || "-summary"}.json`, JSON.stringify(r.body, null, 1));
}
const ann = await api("/profile/wow/character/spineshatter/lynewebaro/specializations", "profile-classicann-eu");
await Bun.write("apps/api/src/lib/__fixtures__/tbc-specializations.json", JSON.stringify(ann.body, null, 1));
