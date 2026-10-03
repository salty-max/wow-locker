#!/usr/bin/env bash
# Vercel build (Build Output API v3): writes .vercel/output with
#   static/            the PWA (apps/web/dist), served by Vercel's CDN
#   functions/api.func the whole API (apps/api/src/vercel.ts) as one Node function
#   config.json        routing (/api/* → the function, link-preview crawlers on
#                      /character/:id → the function too, files, then the SPA
#                      fallback) and the cron calling /api/admin/tick (Pro plan)
# and applies database migrations on production deploys.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.vercel/output
rm -rf "$OUT" && mkdir -p "$OUT/static" "$OUT/functions/api.func"

bun run --filter @wow-locker/web build
cp -R apps/web/dist/. "$OUT/static/"

# One self-contained ESM file: Bun resolves the @/ aliases and the workspace.
(cd apps/api && bun build src/vercel.ts --target=node --format=esm --minify-syntax \
  --outfile "../../$OUT/functions/api.func/index.mjs")
cat > "$OUT/functions/api.func/.vc-config.json" <<JSON
{
  "runtime": "nodejs22.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "shouldAddHelpers": false,
  "supportsResponseStreaming": true,
  "maxDuration": 60
}
JSON

cat > "$OUT/config.json" <<'JSON'
{
  "version": 3,
  "crons": [{ "path": "/api/admin/tick", "schedule": "*/2 * * * *" }],
  "routes": [
    { "src": "^/api(/.*)?$", "dest": "/api" },
    {
      "src": "^/character/\\d+/?$",
      "has": [{ "type": "header", "key": "user-agent", "value": { "re": "Discordbot|Twitterbot|Slackbot|facebookexternalhit|Facebot|TelegramBot|WhatsApp|LinkedInBot|redditbot|SkypeUriPreview|Mastodon|Bluesky|Embedly|iframely|Pinterest" } }],
      "dest": "/api"
    },
    { "src": "^/assets/(.*)$", "headers": { "cache-control": "public, max-age=31536000, immutable" }, "continue": true },
    { "src": "^/(sw\\.js|push-sw\\.js|workbox-[^/]+\\.js|manifest\\.webmanifest|index\\.html)?$", "headers": { "cache-control": "no-cache" }, "continue": true },
    { "handle": "filesystem" },
    { "src": "^/(.*)$", "dest": "/index.html" }
  ]
}
JSON

# Migrations on production deploys only (previews share the same database).
if [ "${VERCEL_ENV:-}" = "production" ]; then
  bun run --filter @wow-locker/api db:migrate
fi
echo "vercel output ready: $(du -sh "$OUT" | cut -f1)"
