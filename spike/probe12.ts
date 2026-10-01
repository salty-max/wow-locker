import { api } from "./probe-lib";
const s = await api("/profile/wow/character/soulseeker/namzie", "profile-classic1x-eu");
console.log("summary", s.status, "last_login", s.body.last_login_timestamp ? new Date(s.body.last_login_timestamp).toISOString() : null, "level", s.body.level, "xp", s.body.experience);
const m = await api("/profile/wow/character/soulseeker/namzie/character-media", "profile-classic1x-eu");
console.log("media", m.status, JSON.stringify(m.body.assets?.map((a: { key: string; value: string }) => `${a.key}: ${a.value.split("/").slice(-1)[0]}`)));
process.exit(0);
