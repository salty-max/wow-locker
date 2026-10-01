import { api } from "./probe-lib";
const s = await api("/profile/wow/character/soulseeker/sealinedion", "profile-classic1x-eu");
console.log(JSON.stringify({ is_ghost: s.body.is_ghost, is_self_found: s.body.is_self_found, experience: s.body.experience, titles: s.body.titles, realm: s.body.realm?.name, gender: s.body.gender?.name }));
const m = await api("/profile/wow/character/soulseeker/sealinedion/character-media", "profile-classic1x-eu");
console.log(m.body.assets.map((a: any) => `${a.key}: ${a.value}`).join("\n"));
