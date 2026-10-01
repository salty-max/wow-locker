import { api } from "./probe-lib";
for (const [realm, name, ns] of [["soulseeker", "namzie", "profile-classic1x-eu"], ["thunderstrike", "namzan", "profile-classicann-eu"], ["soulseeker", "sealinedion", "profile-classic1x-eu"]]) {
  const r = await api(`/profile/wow/character/${realm}/${name}/character-media`, ns);
  console.log(name, realm, r.status, JSON.stringify(r.body.assets?.map((a: { key: string }) => a.key)));
}
process.exit(0);
