# WoWLocker

WoW Classic character tracker PWA (Hardcore-friendly): roster per device,
gear / talents / stats / XP / alive-or-fallen, change timeline, push. Built on
the Farseer template (same monorepo, stack, push code, theme).

## Monorepo (Turborepo + Bun workspaces)

- `apps/api` — Hono on Bun. `src/lib/bnet.ts` (Battle.net client: token cache,
  shared pacer, retries), `realms.ts` (realm search per flavour, cached 24 h),
  `normalize.ts` (raw profile → our shapes), `diff.ts` (snapshot → events,
  pure), `tracker.ts` (add / refresh / refreshDue / notifyPending),
  `push.ts` + `webpush.ts` + `notify.ts`. `src/scheduler.ts`: tick every 2 min,
  each character ≤ every 10 min (1 request when its last login didn't move),
  fallen / missing ones daily, dormant after 30 days unopened.
- `apps/web` — React 19 + Vite + Tailwind v4 + TanStack Router/Query. Routes in
  `src/router.tsx`: `/` locker, `/character/$id`, `/settings`. The roster is
  per device (`lib/roster.ts`, localStorage); Hardcore realm labels in `lib/wow.ts`.
- `packages/shared` (`@wow-locker/shared`) — wire contract. Source of truth.

## Talent trees (static data)

The Battle.net API has NO talent data for Classic (every talent/tree/spell
endpoint 404s in classic1x/classicann). `apps/web/scripts/talents.ts`
(`bun run --filter @wow-locker/web talents`) builds `apps/web/src/data/talents/{flavour}.json`
from the game's DB2 tables exported by wago.tools (Talent, TalentTab,
SpellName, SpellMisc, ManifestInterfaceData). Talent ids match the profile's
`talent.id`. Commit the output; re-run after patches. MoP Classic (talent rows)
is not generated and keeps the points-per-tree view. Icons:
`render.worldofwarcraft.com/{flavour}-{region}/icons/56/{icon}.jpg`.

## Game interface textures

`apps/web/public/slots/*.png` (empty equipment slots, FileDataIDs 136510–136530,
plus `bag-empty.png` cut out of ContainerFrame/UI-Bag-4x4) and
`apps/web/public/ui/cursor-point(@2x).png` (Cursor/Point, the gauntlet, used
site-wide in index.css; text fields keep the text cursor).
Bars use the game's too: `ui/xp-frame.png` (the 20-bubble frame, assembled from
four strips of MainMenuBar/UI-MainMenuBar-Dwarf as Classic's StatusTrackingBar.xml
does) over `ui/statusbar.png` tinted with the ExpBar colours, `ui/exhaustion-tick.png`
for rested; skill/reputation bars = `ui/skill-bar.png` tinted + `ui/skill-border.png`
(a 9-slice border-image). The render CDN only
serves the icon library, so `apps/web/scripts/ui-textures.py` downloads the BLPs
from wago.tools and converts them with Pillow (cursors are palettized with a
1-bit mask that Pillow misreads: decoded by hand). Committed; re-run only if they
change. Back slot = chest texture, 2nd ring = "rfinger", ranged = "relic" for
paladins/druids/shamans (as in FrameXML).

## Zone maps and pet icons

`apps/web/public/maps/<uiMapID>.webp` (65 zones and cities, Classic Era +
Anniversary, 1002×668, ~8 MB, not precached: cached once opened) are built by
`apps/web/scripts/maps.py` from the UiMap / UiMapXMapArt / UiMapArtTile DB2
tables (wago.tools) and the 12 tiles per map, fully explored (every
WorldMapOverlay area composited on the base parchment); `src/data/maps.json` lists them.
The addon's x/y are percentages of that map (`state.mapId`, and `mapId` on
deaths, close calls, pet deaths). No dungeon maps (Era has none in game).
`src/data/petIcons.json` (`scripts/pet-icons.py`): icon file id → icon name
for pet families and warlock demons, since the addon only gets file ids.

## Addon (`addon/WowLocker`)

Lua 5.1 addon for Classic Era/Hardcore + TBC Anniversary (TOC `## Interface:
11509, 20506`). Writes `WowLockerDB` (SavedVariables, per character GUID:
`events` + `state`) — addons have no network access; the Go companion uploads
the file (see Companion). Simulate a session with `luajit addon/test/sim.lua` (it
asserts every recording). Event types: login, logout (both with level, xp, money: the
site's session recaps), gear, level (+played),
talent, respec, guild, death (killer, zone, coords, instance), quest (title,
xp, money), close_call (<15% health, reset above 50%), dungeon_enter /
dungeon_leave (group, duration, deaths, close calls), loot (green+, own only,
localized patterns), skill (learned / every 25 points), reputation (new
standing). State also keeps levelPlayed, questsCompleted, skills, reputations,
resting (inn/city: rested rate), mail (read while a mailbox is open: letters
with items, expiresAt, onExpiry returned|deleted; hasNew from login) and
cooldowns (known timed crafts — Mooncloth, transmutes, Salt Shaker, TBC
cloths — with a real-clock readyAt converted from GetTime). These feed
offline push notifications: mail expiring, fully rested, cooldown ready.
Verified on a real session (2026-10-02): the GUID `Player-<realmId>-<hex>`
decodes to the Battle.net API character id (`0x03D658B8` = 64379064 = Namzie)
and `<realmId>` is the API realm id (6113 = Soulseeker) — match uploads on
that, not on names. By PLAYER_LOGOUT the client reads XP/money as 0: the
final snapshot must not re-read them.

## Companion (`companion/`, Go)

Tray app (fyne.io/systray; macOS needs cgo, Windows builds from a Mac with
CGO_ENABLED=0). `luasv.go` parses SavedVariables as data (never executes it):
tables with keys exactly 1..n become arrays. `testdata/sim.{lua,json}` come
from the addon sim (`WL_SV=… WL_DUMP=… luajit addon/test/sim.lua`): regenerate
both after changing the addon. `sync.go` polls file mtimes every 3 s, waits 2 s
for the game to finish writing, uploads when the file's hash (+ selection)
changed. Pairing: `POST /api/companion/pair/start` → browser on `/pair` →
Battle.net login → poll for the token (`apps/api/src/lib/companion.ts`).
Settings page on 127.0.0.1:47615 (also the single-instance lock), every API
call needs the config's key in `X-Locker-Key` + a matching Host header.
Release builds: `companion/scripts/build.sh` (macOS only), run by the release
workflow; see Operations.
Windows builds are unsigned, so Smart App Control judges them by behaviour:
never start PowerShell, rundll32, cmd or any script host (0.1.2's PowerShell
system notifications got it blocked). The folder picker and opening links are
direct Win32 calls (`platform_windows.go`); the .exe embeds an icon, version
info and a manifest (go-winres in build.sh). Signing is the real fix.
Upload feedback stays inside the companion (the user's choice): the tray's
status line ("Uploading X…", then "✓ X synced · +N events" for a minute) and
a toast on its settings page. No system notifications.

## Hosting (Vercel Pro + Supabase, see DEPLOY.md)

No long-lived process in prod: `scripts/vercel-build.sh` bundles the API
(`apps/api/src/vercel.ts`) into one Node function (Build Output API), the PWA
goes to the CDN. The scheduler is `runTick()` (`lib/tick.ts`): in process on
the Bun server, `/api/admin/tick` (CRON_SECRET) from Vercel Cron (declared in the build's
config.json);
a DB lease prevents overlap, a 45 s budget fits the 60 s function limit.
Never keep request-spanning state in memory: use `lib/ephemeral.ts`
(Postgres, TTL'd, swept by the tick). Background work after a response goes
through `waitUntil` (@vercel/functions; a no-op elsewhere).
Link previews: crawlers' user agents (Discordbot, Slackbot…) on
`/character/:id` are routed to the function, which answers an OpenGraph page
(`lib/og.ts`); people get the SPA.

## Accounts and privacy

A Battle.net login creates an account (`lib/accounts.ts`, keyed on the
Battle.net account id) and a session: cookie `wl_session` (httpOnly,
SameSite=Lax), only its SHA-256 stored, 180-day sliding expiry; account
writes also check Origin. The access token is never kept. The login records
which Battle.net characters are the account's (`accounts.owned`) and sets
`characters.owner_id`; companions paired from that Battle.net account attach
to it, and their uploads join the account's roster. Guests still work: the
web stores (`lib/roster.ts`, `lib/settings.ts`) stay the UI's source and
`lib/account.ts` syncs them with `/api/me` (first login on a device merges).
Privacy (`lib/privacy.ts`): unowned characters are public; an owned one hides
bags, bank, mail, gold, crafts and position (and reminders, recap gold) from
everyone but its owner unless `shared`. Every per-viewer API answer must go
through it (summaries, detail, item search, memorial, pushes of personal
events). Deleting an account wipes its characters' addon data, since they
would otherwise turn public.

## Security and retention

- Supabase also serves `public` over its REST API: `db/migrate.ts` enables RLS
  (no policies) on every table and revokes the `anon`/`authenticated` grants
  after each migration run. The app connects as the owner (RLS doesn't apply).
- Rate limits per IP (`lib/rateLimit.ts`, counted in `ephemeral`) on whatever
  costs a Battle.net call or a stored row: tooltips (item ids ≤ 300 000),
  adding a character, logins, pairings, push subscriptions, item search,
  uploads. Add one to any new endpoint of that kind.
- Security headers (CSP, frame-ancestors, nosniff…) live in
  `apps/web/security-headers.json`: on every response in prod, and in
  `vite preview` (port 4174) to try a policy before shipping it.
- Retention (`lib/retention.ts`): noise (logins, /reload logouts, accepted
  quests, skill-ups, reminders) pruned after 90 days by the tick (recaps saved
  onto logouts first) and skipped at upload; 20 000 events max per character;
  a `db.size` warning past 400 MB.

## Operations (all scripted)

- **Deploy the site**: push to `main` (Vercel Git integration; migrations +
  table lockdown run on production builds). If a push doesn't deploy:
  `vercel deploy --prod --scope jellycat --yes` (refresh the CLI token with
  `vercel whoami` first).
- **Release** (addon / companion / site version): write the notes (markdown,
  for players: they become the GitHub release and the CurseForge changelog),
  then `scripts/release.sh [--addon X.Y.Z] [--companion X.Y.Z] NOTES.md`
  (`--dry-run` first). It bumps every version (TOC, main.go, downloads.ts,
  package.json), runs the checks, commits `chore(release): vX.Y.Z`, tags (the
  tag message = the notes) and pushes. `.github/workflows/release.yml` then
  builds on macOS, publishes the GitHub release and calls `curseforge.yml`,
  which uploads the addon only if its version changed (project 1724925;
  variable `CURSEFORGE_PROJECT_ID`, secret `CURSEFORGE_TOKEN`; game versions
  from the TOC's Interface list via `scripts/curseforge-upload.sh`; project
  page text in `addon/CURSEFORGE.md`).
- **CI** (`ci.yml`) on every push and PR: typecheck, lint, tests, build,
  addon sim, companion vet/test (macOS). Dependabot opens weekly grouped PRs.
- **Monitoring** (`monitor.yml`, every 30 min): `/api/status` must answer 200
  (scheduler ran within 10 min); a failure emails the repo owner.
- **Production database**: `scripts/prod-sql.sh "SQL"` (read only;
  `--write` to change data). Never put the database URL on a command line or
  in output: it contains the password.
- Don't poll wow-locker.app in tight loops: Vercel's bot protection then
  challenges this network's IP (403 "Security Checkpoint", lifts in minutes),
  which also blocks the companion's uploads from the same network.

## Derived views (pure, tested)

- Session recaps (`lib/sessions.ts`): first login → last logout, a login within
  3 min of a logout is a /reload. Shown in the timeline; pushed (event type
  `session`, opt-in) by the tick once the reload gap is over
  (`pushSessionRecaps`), never straight from an upload.
- Dangers (`lib/dangers.ts`): close calls / deaths by foe, place, dungeon, on
  the character page and the memorial (`/api/memorial`, whole roster).
- Today (`lib/today.ts` → `CharacterSummary.today`, `web/lib/todayView.ts`):
  cooldowns, rested, mail and bags across the roster.

## Battle.net API facts (verified live, see spike/FINDINGS.md)

- Namespaces: `classic1x` (Era, Hardcore incl. Anniversary HC = Soulseeker, SoD),
  `classicann` (TBC Anniversary), `classic` (MoP Classic). No Forever namespace.
- Profile summary has `is_ghost` (Hardcore death), `is_self_found`, `experience`.
- Classic: /achievements (Era), /professions, /titles → 404.
- Auction house: only MoP Classic answers; `classic1x` + `classicann` → 404.

## Commands

```bash
bun run dev | typecheck | lint | test | build
bun run db            # local Postgres :5434 (docker, container wow-locker-pg)
bun run db:generate   # migration from apps/api/src/db/schema.ts
bun run db:migrate
```

Dev ports are api 3001 / web 5174 so Farseer (3000/5173) can run alongside.

## Conventions

- Conventional Commits, lowercase subjects; no AI co-author trailers.
- No hardcoded UI text: `apps/web/src/lib/i18n.ts` (`fr` typed on `en`); push
  copy rendered server-side per device language in `apps/api/src/lib/notify.ts`.

## ⚠️ Secrets

`apps/api/.env.local` (gitignored): Battle.net client id/secret (client
"wow-locker" on develop.battle.net), VAPID keypair, CRON_SECRET. Never commit
or print them.
