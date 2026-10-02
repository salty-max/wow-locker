# wow-locker

Track your **World of Warcraft Classic** characters in one installable PWA,
**Hardcore-friendly**: level and XP, gear (with enchants and icons), talents,
stats, alive or fallen, Self-Found, and a timeline of what changed, with push
notifications.

- **Locker**: your roster, kept per device. Add a character by region, realm
  and name; Hardcore realms are labelled and listed first.
- **Character page**: render, XP bar, paper-doll gear, talent trees, stats,
  timeline (level-ups, deaths, gear changes, respecs, guild changes,
  Self-Found lost).
- **Push**: per device, for the characters in its locker and the event types
  you pick.

- **Look**: the Classic (1.x) WoW UI — character select screen, Character
  frame with the paper doll, real talent trees, the timeline as a chat window,
  WoW-style item and talent tooltips (drawn in CSS, no game assets).
- **Log in with Battle.net** to import your account's characters (nothing about
  the account is stored).

Data comes from the official **Battle.net API** (client credentials). Profiles
only update when a character logs out. Supported flavours, verified 2026-10-01
(see `spike/FINDINGS.md`): Classic Era / Hardcore / Season of Discovery
(`classic1x`), TBC Anniversary (`classicann`) and MoP Classic (`classic`).
WoW: Forever has no API yet. Not affiliated with Blizzard Entertainment.

## In-game addon (`addon/WowLocker`)

The API only sees characters as they were at their last logout. The addon
records what happens in between — every gear swap, level-up (with /played),
talent point, guild change, quest turned in, notable loot, profession and
reputation milestone, dungeon run, Hardcore close call and death (killer, zone,
coordinates) — plus rested XP, gold, /played, location and completed quests. Addons can't reach the network, so it writes its
SavedVariables on logout or `/reload`; the companion app uploads them. Test it
outside the game with `luajit addon/test/sim.lua`.

## Companion app (`companion/`)

A small Go app living in the macOS menu bar / Windows tray. It finds the game
folders (`_classic_era_`, `_anniversary_`, …), watches each account's
`SavedVariables/WowLocker.lua`, and uploads it a few seconds after the game
writes it (logout, `/reload`, disconnect).

- **Linking**: "Link with Battle.net" opens wow-locker's `/pair` page; the
  Battle.net login proves which characters are yours, and the server only
  accepts uploads for those. The companion keeps an upload token, nothing else.
- **Settings** (a page served on `127.0.0.1` only, opened from the icon): WoW
  folders (detected or added), which accounts and characters to upload, launch
  at login, server address.
- The SavedVariables file is parsed as data by a dedicated reader, never
  executed.

```bash
cd companion
go test ./...                       # parser checked against the addon simulation
go run . --headless                 # no tray; settings at the printed URL
WOWLOCKER_SERVER=https://… scripts/build.sh   # dist/: macOS .app, Windows .exe, addon zip
```

`WOWLOCKER_CONFIG_DIR` and `WOWLOCKER_NO_BROWSER=1` isolate a test run from
your real config.

## Stack

Same as Farseer: Turborepo + Bun workspaces, `apps/api` (Hono, Drizzle,
Postgres, node-cron), `apps/web` (React 19, Vite, Tailwind v4, TanStack
Router/Query, vite-plugin-pwa), `packages/shared` (wire contract).

## Develop

```bash
bun install
bun run db             # Postgres in Docker on :5434
bun run db:migrate
# apps/api/.env.local needs BNET_CLIENT_ID / BNET_CLIENT_SECRET (see .env.example)
bun run --filter @wow-locker/api vapid   # push keys, also into .env.local
bun run dev            # api :3001 + web :5174
```

Checks: `bun run typecheck && bun run lint && bun run test && bun run build`.

Hosting: Vercel Pro (with Vercel Cron) + a free Supabase project — see
[DEPLOY.md](DEPLOY.md).
