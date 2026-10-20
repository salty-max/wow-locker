# WoWLocker

WoW Classic character tracker PWA (Hardcore-friendly): roster per device,
gear / talents / stats / XP / alive-or-fallen, change timeline, push. Built on
the Farseer template (same monorepo, stack, push code, theme). Its addon
(`addon/WowLocker`) and Ravenpost (salty-max/ravenpost) feed it. On hold
(Forever's launch first); salty-max/wow-locker. Read
the family's CLAUDE.md (`../CLAUDE.md`) first.

## Where things are

| What | Where |
|---|---|
| The monorepo, static data (talents, textures, maps), the addon, the companion's server side, hosting, accounts and privacy, security and retention, operations, derived views, Battle.net API facts | `docs/architecture.md` |
| Hosting and deploys in detail | `DEPLOY.md` |
| Forever's port plan | `FOREVER.md` |
| What Battle.net's API really does | `spike/FINDINGS.md` |
| Turborepo's own agent notes (managed by turbo) | `AGENTS.md` |

## Commands

```bash
bun run dev | typecheck | lint | test | build
bun run check         # typecheck, lint, test, the addon's sim
bun "$(git rev-parse --path-format=absolute --git-common-dir)/../../addon-kit/q.ts" check -- bun run check   # the same, quiet, stamping the tree for the push
bun run db            # local Postgres :5434 (docker, container wow-locker-pg)
bun run db:generate   # migration from apps/api/src/db/schema.ts
bun run db:migrate
scripts/release.sh [--version X.Y.Z] [--addon X.Y.Z] [--hold] NOTES.md   # check, tag, push
```

Dev ports are api 3001 / web 5174 so Farseer (3000/5173) can run alongside.

## Hard rules

- Every per-viewer API answer goes through `lib/privacy.ts`: an owned
  character's bags, bank, mail, gold, crafts and position are its owner's
  unless shared. The Battle.net access token is never kept; the session
  cookie only as its hash.
- Any new endpoint that costs a Battle.net call or a stored row gets a rate
  limit (`lib/rateLimit.ts`). RLS stays on every table after a migration.
- No request-spanning state in memory in prod (`lib/ephemeral.ts`), work
  after a response through `waitUntil`.
- No hardcoded UI text: `apps/web/src/lib/i18n.ts` (`fr` typed on `en`); push
  copy rendered server-side per device language in `apps/api/src/lib/notify.ts`.
- After changing the addon, regenerate Ravenpost's `testdata/sim.{lua,json}`
  there (`WL_SV`/`WL_DUMP`).
- `bun install` runs husky, which takes `core.hooksPath` back: the
  `prepare` script installs the family's hooks again (husky's run after
  ours, chained).
- Conventional Commits, lowercase subjects; no AI co-author trailers.
  Commit locally; ask before any push, release or deploy. The pre-push hook
  wants a check stamp on the tree (q), which `release.sh` makes after the
  version bump.

## ⚠️ Secrets

`apps/api/.env.local` (gitignored): Battle.net client id/secret (client
"wow-locker" on develop.battle.net), VAPID keypair, CRON_SECRET. Never commit
or print them.
