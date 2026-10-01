import { api } from "./probe-lib";
// Poll Namzie's profile until Blizzard reflects the new login (max ~90 min).
const start = Date.now();
for (;;) {
  const s = await api("/profile/wow/character/soulseeker/namzie", "profile-classic1x-eu");
  const login = s.body.last_login_timestamp ? new Date(s.body.last_login_timestamp).toISOString() : null;
  if (login && !login.startsWith("2025-04-12")) {
    const m = await api("/profile/wow/character/soulseeker/namzie/character-media", "profile-classic1x-eu");
    console.log(`UPDATED after ${Math.round((Date.now() - start) / 60000)} min: last_login ${login}, assets ${JSON.stringify(m.body.assets?.map((a: { key: string }) => a.key))}`);
    process.exit(0);
  }
  if (Date.now() - start > 90 * 60_000) {
    console.log(`NOT UPDATED after 90 min (last_login still ${login})`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 3 * 60_000));
}
