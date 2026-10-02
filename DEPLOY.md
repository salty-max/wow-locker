# Deploying wow-locker (Vercel Pro + Supabase)

Vercel Pro (the PWA on the CDN, the API as one Node function, Vercel Cron for
the scheduler) and a free Supabase project (Postgres).

How it fits together:

- `vercel.json` runs `scripts/vercel-build.sh`, which writes `.vercel/output`
  (Build Output API v3): the web build as static files, the whole API bundled
  into `functions/api.func` (entry `apps/api/src/vercel.ts`), routes
  `/api/*` → the function, everything else → files, then `index.html`.
- Production deploys apply database migrations during the build (`MIGRATE_URL`).
- No process stays up on Vercel, so the scheduler is an HTTP call: Vercel Cron
  calls `/api/admin/tick` every 2 minutes (declared in the build's
  `config.json`; Vercel sends `Authorization: Bearer $CRON_SECRET`) (refresh due characters, retry pushes, fire
  reminders, sweep expired rows). A lease in the database stops overlapping
  ticks; each tick stops starting work after 45 s (functions get 60 s).
- Short-lived state (Battle.net logins, imports, companion pairings) lives in
  the `ephemeral` table, so any function instance can answer any request.

## 1. Supabase

1. New project (an EU region, e.g. Frankfurt). Note the database password.
2. **Connect** → copy two connection strings, password filled in, each with
   `?sslmode=require` appended:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Session pooler** (port 5432) → `MIGRATE_URL`

## 2. Vercel

1. **Add New → Project**, import `salty-max/wow-locker`. Framework preset
   **Other**, root directory the repo root (`vercel.json` sets the commands).
2. **Settings → Functions → Region**: the one next to the Supabase project
   (`fra1` for Frankfurt).
3. **Settings → Environment Variables** (Production):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler URL |
   | `MIGRATE_URL` | Supabase session pooler URL |
   | `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET` | the Battle.net client |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `bun run --filter @wow-locker/api vapid` |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `APP_ORIGIN` | `https://<project>.vercel.app` (or your domain) |
   | `LOG_FORMAT` | `json` |

4. Deploy, then check `https://<project>.vercel.app/api/health` → `{"ok":true}`.

## 3. Battle.net

On develop.battle.net, add `https://<project>.vercel.app/api/auth/callback` to
the client's redirect URLs (keep the localhost one for development).

## 4. Cron

Nothing to set up: the deployment declares the cron, and **Settings → Cron
Jobs** lists it after the first production deploy. It needs `CRON_SECRET` to
be set (step 2). Each run answers like
`{"ran":true,"checked":3,"pushed":1,"reminders":0,…}` (`"ran":false`: the
previous tick was still running), visible in the function logs.

On the Hobby plan, crons run at most once a day: remove `crons` from
`scripts/vercel-build.sh` and call the same URL every 2 minutes from an
external service instead (e.g. cron-job.org, with the
`Authorization: Bearer <CRON_SECRET>` header).

## 5. Companion

Build it pointing at the deployment:

```bash
WOWLOCKER_SERVER=https://<project>.vercel.app bun run companion:build
```

`companion/dist/` then holds the macOS app, the Windows executables and the
addon zip.

## Limits to keep in mind

- Function requests are capped at 4.5 MB; companion uploads are capped at 4 MB
  (a SavedVariables file with 5,000 events is about 1 MB of JSON).
- The Bun server (`bun run start`, the Dockerfile) still works for any host
  with a long-lived process: it runs the same tick in process.
