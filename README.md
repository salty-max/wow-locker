# WoWLocker

WoWLocker lets you check your World of Warcraft Classic characters on your
phone. Browse gear and talents, see what changed during a session, check
bags and mail, or look back at a Hardcore character's deaths and close calls.
It is an installable web app at **[wow-locker.app](https://wow-locker.app)**,
with an interface based on the game.

The website supports Classic Era, Hardcore, Season of Discovery, TBC
Anniversary and MoP Classic. The addon supports Classic Era and TBC
Anniversary, including Hardcore and Season of Discovery.

## Getting started

1. Open [wow-locker.app](https://wow-locker.app), sign in with Battle.net and
   import your characters. You can also add a character by realm and name.
2. For details Battle.net cannot provide, install the
   [WoWLocker addon](https://www.curseforge.com/projects/1724925) and
   [Ravenpost](https://github.com/salty-max/ravenpost), the companion app for
   Windows and macOS. Both are available from
   [wow-locker.app/addon](https://wow-locker.app/addon).
3. Add the website to your phone's Home Screen. Turn on notifications in
   Settings if you want reminders.

Ravenpost is not code-signed yet, so Windows SmartScreen and macOS Gatekeeper
warn on first launch. The addon page includes setup instructions.

## What you can see

Battle.net provides a character's level and XP, gear with item tooltips,
talents, stats, guild, Hardcore status and Self-Found status. The site keeps
a timeline of changes such as levels, gear swaps, respecs and guild changes.

For your own characters, the addon and Ravenpost add:

- **A detailed timeline.** Gear swaps, levels, talent points, quests, notable
  loot, skills, reputation, dungeon runs, pets, deaths and close calls,
  with timestamps.
- **Session summaries.** Time played, levels, XP, gold, quests, loot and
  dangerous fights, also available as a notification after logout.
- **Inventory and progress.** Bags, bank, mail, gold, played time, skills,
  reputation, levelling pace, hunter pets and the stable. Search for items
  across your characters and see how much rested XP they gain offline.
- **Zone maps.** Fully explored maps with your position, deaths and close calls.
- **Today.** Ready crafting cooldowns, fully rested characters, new or expiring
  mail and upcoming reminders across your roster.
- **Memorial.** Fallen characters and their last hour, with deaths and close
  calls grouped by enemy, place and dungeon.
- **Offline reminders.** Notifications for expiring mail, full rested XP and
  ready crafting cooldowns.

Bank contents update when you visit the bank. Mail updates when you open a
mailbox. Logging in with Battle.net keeps your roster, language and
notification preferences available on each device.

Bags, bank, mail, gold and position are private unless you share the
character. Shared links have preview cards for Discord and other chats.
Read more on the [privacy page](https://wow-locker.app/privacy).

## How it works

```text
WoW addon -> Saved file -> Ravenpost -> wow-locker.app
Battle.net API ----------------------> wow-locker.app
```

The **addon**, in `addon/WowLocker`, records events in the background. WoW
writes its saved file when you log out or use `/reload`. Addons cannot
connect to the internet themselves.

**Ravenpost** watches `SavedVariables/WowLocker.lua` and uploads it a few
seconds after the game writes it. Linking through Battle.net identifies
your characters, and the server only accepts uploads for those characters.
The file is parsed as data and never executed. Upload status is available
in the tray and on Ravenpost's local settings page. Ravenpost has its
[own repository](https://github.com/salty-max/ravenpost) and also uploads
Hearthtale journals.

The **API**, in `apps/api`, checks Battle.net for changes and turns those
changes and addon uploads into timeline events, session summaries and
reminders. It applies privacy per viewer, limits requests and removes
routine timeline noise after 90 days.

The **web app**, in `apps/web`, is a React PWA. Its interface textures, maps
and icons come from the game files through [wago.tools](https://wago.tools)
and belong to Blizzard Entertainment.

## Development

The repository uses Bun workspaces and Turborepo. The API uses Hono,
Drizzle and Postgres. The web app uses React 19, Vite, Tailwind v4,
TanStack Router and Query, and vite-plugin-pwa. Shared types live in
`packages/shared`. The addon uses Lua 5.1. Ravenpost is written in Go and
uses fyne.io/systray.

```bash
bun install
bun run db             # Start Postgres in Docker on port 5434
bun run db:migrate
# Add BNET_CLIENT_ID and BNET_CLIENT_SECRET to apps/api/.env.local (see .env.example)
bun run --filter @wow-locker/api vapid   # Generate push keys for .env.local
bun run dev            # API on port 3001, web on port 5174
```

CI runs these checks on every push and pull request:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
luajit addon/test/sim.lua
```

The addon simulation replays a game session. Ravenpost's checks live in
its own repository.

## Releases and operations

The site is hosted on Vercel with Supabase Postgres. A push to `main`
deploys the site and runs database migrations. See [DEPLOY.md](DEPLOY.md).

`scripts/release.sh [--addon X.Y.Z] NOTES.md` updates versions, runs checks,
tags and pushes. GitHub Actions publishes a GitHub release and uploads the
addon to CurseForge and Wago when the addon version changes. Use `--hold`
to publish only on GitHub. Ravenpost releases from its own repository.

An uptime check calls `/api/status` every 30 minutes. Dependabot opens
weekly update pull requests.

The addon store description is in [addon/CURSEFORGE.md](addon/CURSEFORGE.md).

## License

[MIT](LICENSE). World of Warcraft and Battle.net are trademarks of Blizzard
Entertainment, Inc. WoWLocker is a fan project and is not affiliated with
or endorsed by Blizzard.
