# WoWLocker

**Your World of Warcraft Classic characters, on your phone.** WoWLocker is an
installable web app (PWA) at **[wow-locker.app](https://wow-locker.app)**,
built for Hardcore: levels, gear, talents, deaths and close calls, bags and
mail, rested XP, with push notifications. It looks and reads like the game's
own interface.

Classic Era, Hardcore, Season of Discovery, TBC Anniversary and MoP Classic.
Not affiliated with Blizzard Entertainment.

## Getting started

1. Open **[wow-locker.app](https://wow-locker.app)**, log in with Battle.net
   and import your characters (or add any character by realm and name).
2. For everything Battle.net doesn't show, install the
   **[WoWLocker addon](https://www.curseforge.com/projects/1724925)** and the
   companion app, **[Ravenpost](https://github.com/salty-max/ravenpost)**
   (Windows / macOS), from [wow-locker.app/addon](https://wow-locker.app/addon).
3. Install the app on your phone (Add to Home Screen) and turn notifications on
   in Settings.

Ravenpost isn't code-signed yet: Windows SmartScreen and macOS Gatekeeper
warn the first time (setup steps on the addon page).

## What it shows

From the **Battle.net API**, for any character:
- Level and XP, gear on the game's paper doll (item tooltips), talent trees,
  stats, guild, Hardcore status (alive or fallen) and Self-Found.
- A timeline of what changed (level-ups, gear, respecs, guild, death), refreshed
  after each logout.

With the **addon and Ravenpost** (your own characters):
- Every gear swap, level-up (with /played), talent point, quest, notable loot,
  skill and reputation milestone, dungeon run, pet, Hardcore close call and
  death (killer, place), timestamped, in a chat-frame timeline.
- **Session summaries**: what each play session brought (time, levels, XP,
  gold, quests, loot, danger), also as a notification when you log out.
- Bags and bank (with item search across all your characters), mailbox, gold,
  /played, rested XP projected while you're offline, skills, reputation,
  levelling pace, hunter pets and the stable.
- **Zone maps** (fully explored) with your position, deaths and close calls.
- **Today**: what needs you across all characters (crafts off cooldown, fully
  rested, new or expiring mail) and what's coming this week.
- **Memorial**: the fallen and their last hour; close calls and deaths by foe,
  place and dungeon.
- **Reminders while the game is closed**: mail about to expire, fully rested,
  cooldown ready.

**Your account**: logging in with Battle.net keeps your locker, language and
notification choices on every device. Bags, bank, mail, gold and position are
visible only to you unless you share a character; its link shows a preview
card on Discord and other chats. Details: [privacy](https://wow-locker.app/privacy).

## How it works

```
 WoW client                    your computer                 wow-locker.app
┌──────────────┐  logout /   ┌──────────────────┐  HTTPS   ┌──────────────────┐
│ WoWLocker    │  /reload →  │ Ravenpost (Go,   │ ───────→ │ API (Hono)       │ ← Battle.net API
│ addon (Lua)  │  saved file │ tray / menu bar) │  upload  │ Postgres         │ → Web Push
└──────────────┘             └──────────────────┘  token   │ PWA (React)      │
                                                           └──────────────────┘
```

- **Addon** (`addon/WowLocker`): addons can't use the network, so it records
  into the game's SavedVariables, written on logout or `/reload`. No impact on
  combat or the interface. `luajit addon/test/sim.lua` simulates a session.
- **Ravenpost** ([its own repo](https://github.com/salty-max/ravenpost), shared with Hearthtale): finds the game folders, watches each account's
  `SavedVariables/WowLocker.lua`, uploads it seconds after the game writes it.
  Linking goes through a Battle.net login, which proves which characters are
  yours: the server only accepts uploads for those. The saved file is parsed as
  data, never executed. Settings on a page served on `127.0.0.1` only; upload
  status in the tray and on that page.
- **Server** (`apps/api`): polls Battle.net for tracked characters, turns
  changes and uploads into timeline events, session summaries and reminders,
  and sends pushes. Per-viewer privacy, rate limits, and a 90-day retention for
  timeline noise.
- **Web** (`apps/web`): React PWA. Interface textures, zone maps and icons come
  from the game's files (via [wago.tools](https://wago.tools)), © Blizzard
  Entertainment.

## Stack

Turborepo + Bun workspaces: `apps/api` (Hono, Drizzle, Postgres), `apps/web`
(React 19, Vite, Tailwind v4, TanStack Router/Query, vite-plugin-pwa),
`packages/shared` (the wire contract). Ravenpost (its own repo) in Go (fyne.io/systray),
addon in Lua 5.1. Hosted on Vercel (functions + cron) and Supabase (Postgres).

## Develop

```bash
bun install
bun run db             # Postgres in Docker on :5434
bun run db:migrate
# apps/api/.env.local needs BNET_CLIENT_ID / BNET_CLIENT_SECRET (see .env.example)
bun run --filter @wow-locker/api vapid   # push keys, also into .env.local
bun run dev            # api :3001 + web :5174
```

Checks (also run by CI on every push and pull request):
`bun run typecheck && bun run lint && bun run test && bun run build`,
`luajit addon/test/sim.lua`. Ravenpost has its own checks in its repo.

## Releases and operations

- **Site**: every push to `main` deploys on Vercel (database migrations
  included). See [DEPLOY.md](DEPLOY.md).
- **Addon**: `scripts/release.sh [--addon X.Y.Z] NOTES.md` bumps the
  versions, runs the checks, then tags and pushes. GitHub Actions publishes the
  GitHub release and uploads the addon to CurseForge when its version changed.
  Ravenpost releases from its own repo.
- **Monitoring**: an uptime check every 30 minutes (`/api/status`);
  Dependabot opens weekly update pull requests.

## License

[MIT](LICENSE). World of Warcraft and Battle.net are trademarks of Blizzard
Entertainment, Inc. WoWLocker is a fan project, not affiliated with or endorsed
by Blizzard.
