#!/usr/bin/env bash
# Query the production database without its URL (or password) ever reaching
# the terminal: the URL comes from apps/api/.env.prod.local into psql's
# environment only, and output lines that would contain it are dropped.
# Read-only unless --write. Needs Docker (psql runs in postgres:16-alpine).
#
#   scripts/prod-sql.sh "select count(*) from characters"
#   scripts/prod-sql.sh --write "delete from ephemeral where kind = 'rate'"
#   scripts/prod-sql.sh --raw "select json_agg(c) from characters c" > out.json
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="read only"
FORMAT=()
while [ $# -gt 1 ]; do
  case "$1" in
    --write) MODE="read write"; shift ;;
    --raw) FORMAT=(-tAq); shift ;; # values only: for exports
    *) break ;;
  esac
done
[ $# -ge 1 ] || { echo "usage: $0 [--write] \"SQL\"" >&2; exit 2; }
ENV_FILE=apps/api/.env.prod.local
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }
DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | tr -d '"'"'")
export DATABASE_URL
# One transaction (-1), declared read only first: Supabase's transaction pooler
# ignores connection options, but not this.
docker run --rm -i -e DATABASE_URL postgres:16-alpine \
  psql "$DATABASE_URL" "${FORMAT[@]}" -v ON_ERROR_STOP=1 -1 -c "set transaction $MODE" -c "$1" 2>&1 | grep -v -e "postgres://" -e "postgresql://" || true
