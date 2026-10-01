#!/usr/bin/env bash
#
# Start (or restart) a local Postgres for dev on :5434 (5432/5433 are left to other
# projects), then print its DATABASE_URL.
#
#   bash scripts/db.sh          # start Postgres
#   bash scripts/db.sh stop     # stop it (data is kept)
#   bash scripts/db.sh reset    # stop + wipe the data dir, then start fresh

set -uo pipefail

NAME="wow-locker-pg"
PORT="5434"
DATA="$PWD/.pgdata"
URL="postgres://wowlocker:wowlocker@localhost:${PORT}/wowlocker"

if command -v container >/dev/null; then RT=container
elif command -v docker >/dev/null; then RT=docker
else
  echo "neither 'container' nor 'docker' is installed" >&2
  exit 1
fi

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

case "${1:-start}" in
  stop)
    "$RT" stop "$NAME" 2>/dev/null && say "stopped $NAME (data kept in .pgdata)"
    exit 0
    ;;
  reset)
    "$RT" stop "$NAME" 2>/dev/null
    "$RT" rm "$NAME" 2>/dev/null
    rm -rf "$DATA"
    say "wiped $NAME and .pgdata"
    ;;
esac

mkdir -p "$DATA"

say "Starting Postgres via $RT"
"$RT" run -d --name "$NAME" \
  -p "${PORT}:5432" \
  -e POSTGRES_USER=wowlocker \
  -e POSTGRES_PASSWORD=wowlocker \
  -e POSTGRES_DB=wowlocker \
  -v "${DATA}:/var/lib/postgresql/data" \
  postgres:16-alpine >/dev/null 2>&1 || "$RT" start "$NAME" >/dev/null 2>&1 || {
  echo "could not start $NAME — is the $RT service running?" >&2
  exit 1
}

say "Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/localhost/${PORT}") 2>/dev/null; then
    exec 3>&- 3<&-
    break
  fi
  sleep 1
done

cat <<EOM

  Postgres is up at ${URL}
  (the api defaults to it — no DATABASE_URL needed locally)

    bun run db:migrate
    bun run dev

EOM
