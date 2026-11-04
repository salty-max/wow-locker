# Battle.net API feasibility — 2026-10-01 (EU, client credentials)

| Flavour | Namespace suffix | Realms | Characters (profile) | Auction house |
|---|---|---|---|---|
| MoP Classic (progression) | `classic` | 34 realms / 25 connected | ✅ summary, equipment (enchants), specializations (talents + glyphs), statistics, media, PvP, achievements, reputations | ✅ `/connected-realm/{id}/auctions` (one house per realm, ~1–10k listings, ≤1 MB) + ✅ region commodities |
| TBC Anniversary | `classicann` | Thunderstrike, Spineshatter, Anniversary (RU) | ✅ same as above minus achievements (404); talents = full TBC trees | ❌ house index OK, every house (2/6/7) → 404 |
| Classic Era + Season of Discovery | `classic1x` | 58 realms / 26 connected | not tested (no leaderboard to find names) | ❌ 0/78 houses answer (404) — bug open since Dec 2024 |
| WoW: Forever | `profile-forever-eu` (5 Nov 2026) | none served | account list ✅ (needs the user's login), character endpoints ❌ 404 | not probed |

- Forever, 1 October: no namespace existed (superseded 5 November, below). Every guess (`forever`, `wowforever`, `classic-forever`…) → 403, identical to a nonsense namespace.
- 404 everywhere: `/professions`, `/titles`, `/hunter-pets` (Classic flavours).
- Listing shape (MoP Classic): `{ id, item: { id }, buyout, quantity, time_left }` — no seller, no bid history.
- Character freshness: `last_login_timestamp` present; no online status.
- Not tested yet: account-level `/profile/user/wow` (needs the user's Battle.net login, OAuth authorization code flow).

## Hardcore (user's realm) — Soulseeker, 2026-10-01

- Soulseeker (EU Anniversary Hardcore) lives in `classic1x`, category "Classic Era" — the API does not label it Hardcore.
- Tested on the user's character Sealinedion (Dwarf Paladin, lvl 17): summary, status, equipment (with enchants), specializations (talent points per tree), statistics, media (avatar + full render), PvP, reputations, appearance → 200. Achievements, professions, titles → 404.
- Summary carries Hardcore-relevant fields: `is_ghost` (false here; presumably true once dead — unverified without a dead character), `is_self_found` (true: Self-Found mode), `experience` (675 into the level).
- Self-Found characters cannot use the auction house at all, so the AH part only matters for non-SSF characters — and Soulseeker's AH endpoints 404 anyway.

## Forever, the day after launch — 2026-11-05

Probed with the user's own login. `profile-forever-eu` lists the account's Forever characters (no realm object; the links carry the pseudo-realm 6946: `protected-character/6946-550204`), account collections answer, `static-forever-eu` serves classes and races (Skyborne 95 and 96); every character path (`character/<name>-<surname>`, protected link, sub-paths) and the dynamic namespace's realm endpoints 404. Details and the plan: `FOREVER.md`, "Battle.net on launch day".
