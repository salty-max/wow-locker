# Battle.net API feasibility — 2026-10-01 (EU, client credentials)

| Flavour | Namespace suffix | Realms | Characters (profile) | Auction house |
|---|---|---|---|---|
| MoP Classic (progression) | `classic` | 34 realms / 25 connected | ✅ summary, equipment (enchants), specializations (talents + glyphs), statistics, media, PvP, achievements, reputations | ✅ `/connected-realm/{id}/auctions` (one house per realm, ~1–10k listings, ≤1 MB) + ✅ region commodities |
| TBC Anniversary | `classicann` | Thunderstrike, Spineshatter, Anniversary (RU) | ✅ same as above minus achievements (404); talents = full TBC trees | ❌ house index OK, every house (2/6/7) → 404 |
| Classic Era + Season of Discovery | `classic1x` | 58 realms / 26 connected | not tested (no leaderboard to find names) | ❌ 0/78 houses answer (404) — bug open since Dec 2024 |
| WoW: Forever | none | — | ❌ | ❌ |

- Forever: no namespace exists. Every guess (`forever`, `wowforever`, `classic-forever`…) → 403, identical to a nonsense namespace.
- 404 everywhere: `/professions`, `/titles`, `/hunter-pets` (Classic flavours).
- Listing shape (MoP Classic): `{ id, item: { id }, buyout, quantity, time_left }` — no seller, no bid history.
- Character freshness: `last_login_timestamp` present; no online status.
- Not tested yet: account-level `/profile/user/wow` (needs the user's Battle.net login, OAuth authorization code flow).

## Hardcore (user's realm) — Soulseeker, 2026-10-01

- Soulseeker (EU Anniversary Hardcore) lives in `classic1x`, category "Classic Era" — the API does not label it Hardcore.
- Tested on the user's character Sealinedion (Dwarf Paladin, lvl 17): summary, status, equipment (with enchants), specializations (talent points per tree), statistics, media (avatar + full render), PvP, reputations, appearance → 200. Achievements, professions, titles → 404.
- Summary carries Hardcore-relevant fields: `is_ghost` (false here; presumably true once dead — unverified without a dead character), `is_self_found` (true: Self-Found mode), `experience` (675 into the level).
- Self-Found characters cannot use the auction house at all, so the AH part only matters for non-SSF characters — and Soulseeker's AH endpoints 404 anyway.
