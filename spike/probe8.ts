import { api } from "./probe-lib";
for (const f of ["classic1x", "classicann", "classic"]) {
  const r = await api("/data/wow/search/realm?_pageSize=1000", `dynamic-${f}-eu`);
  const res = r.body?.results ?? [];
  const s = res[0]?.data;
  console.log(f, r.status, res.length, "results; sample:", s ? JSON.stringify({ slug: s.slug, name: s.name?.en_GB, category: s.category?.en_GB, type: s.type?.name?.en_GB ?? s.type?.type }) : "-");
}
const icon = await api("/data/wow/media/item/4564", "static-classic1x-eu");
console.log("item media:", icon.status, JSON.stringify(icon.body?.assets));
process.exit(0);
