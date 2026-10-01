#!/usr/bin/env bash
#
# Dev entrypoint: runs the turbo dev servers (api :3001 + web :5174). Set
# TUNNEL=1 to also open a Cloudflare quick tunnel (https, needed to install the
# PWA and test push on a phone) once the web server is up.
#
#   bun run dev            # servers only
#   TUNNEL=1 bun run dev   # servers + public quick tunnel (see scripts/tunnel.sh)

set -uo pipefail

WEB="http://localhost:5174"

tunnel_pid=""
cleanup() {
  [ -n "$tunnel_pid" ] && kill "$tunnel_pid" 2>/dev/null
  pkill -f "cloudflared tunnel --url ${WEB}" 2>/dev/null
}
trap cleanup EXIT INT TERM

if [ -n "${TUNNEL:-}" ]; then
  (
    for _ in $(seq 1 60); do
      curl -fsS -o /dev/null --max-time 2 "$WEB" 2>/dev/null && exec bash scripts/tunnel.sh
      sleep 1
    done
    echo "  (web server did not come up in 60s — tunnel skipped)" >&2
  ) &
  tunnel_pid=$!
fi

exec turbo run dev
