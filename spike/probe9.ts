import { api } from "./probe-lib";
for (const [path, ns] of [
  ["/data/wow/talent-tree/index", "static-classic1x-eu"],
  ["/data/wow/talent/index", "static-classic1x-eu"],
  ["/data/wow/playable-class/2/talent-slots", "static-classic1x-eu"],
  ["/data/wow/playable-specialization/index", "static-classic1x-eu"],
  ["/data/wow/talent/1449", "static-classic1x-eu"],
  ["/data/wow/media/spell/20261", "static-classic1x-eu"],
  ["/data/wow/spell/20261", "static-classic1x-eu"],
  ["/data/wow/talent/index", "static-classicann-eu"],
] as const) {
  const r = await api(path, ns);
  console.log(r.status, path, ns, r.status === 200 ? JSON.stringify(r.body).slice(0, 300) : "");
}
process.exit(0);
