import { api } from "./probe-lib";
for (const ns of ["dynamic-classicann-eu", "dynamic-classic1x-eu"]) {
  const r = await api("/data/wow/realm/index", ns);
  const hits = r.body.realms.filter((x: any) => /soulseeker|hardcore|stitches|nek|thunderstrike|spineshatter|anniversary/i.test(x.name + x.slug));
  console.log(ns, r.body.realms.length, "realms:", hits.map((x: any) => `${x.name}(${x.slug}, id ${x.id})`).join(", "));
}
for (const slug of ["soulseeker", "stitches", "nekrosh"]) {
  for (const ns of ["dynamic-classic1x-eu", "dynamic-classicann-eu"]) {
    const d = await api(`/data/wow/realm/${slug}`, ns);
    if (d.status === 200) console.log(`${slug} in ${ns}: category=${d.body.category} type=${d.body.type?.name} timezone=${d.body.timezone} tournament=${d.body.is_tournament} connected=${d.body.connected_realm?.href?.match(/connected-realm\/(\d+)/)?.[1]}`);
  }
}
