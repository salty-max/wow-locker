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

## Addon (`addon/WowLocker`)

Lua 5.1 addon for Classic Era/Hardcore + TBC Anniversary (TOC `## Interface:
11509, 20506`). Writes `WowLockerDB` (SavedVariables, per character GUID:
`events` + `state`) — addons have no network access; the Go companion uploads
the file (see Companion). Simulate a session with `luajit addon/test/sim.lua` (it
asserts every recording). Event types: login, logout, gear, level (+played),
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
Release: `WOWLOCKER_SERVER=https://… companion/scripts/build.sh`.

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
