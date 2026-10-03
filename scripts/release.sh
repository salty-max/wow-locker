#!/usr/bin/env bash
# Cut a release: bump versions, check, commit, tag, push. GitHub Actions then
# builds and publishes it (.github/workflows/release.yml → GitHub release +
# CurseForge), and Vercel deploys main.
#
#   scripts/release.sh [options] NOTES.md
#
#   NOTES.md            release notes (markdown): the tag's message, then the
#                       GitHub release's and CurseForge's changelog
#   --version X.Y.Z     the release (default: the latest tag's patch + 1)
#   --addon X.Y.Z       new addon version (addon/WowLocker/WowLocker.toc)
#   --companion X.Y.Z   new companion version (companion/main.go)
#   --skip-checks       don't run typecheck / lint / tests / addon sim
#   --dry-run           show what would change, change nothing
#
# The site version (package.json, shown in Settings) follows the release.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="" ADDON="" COMPANION="" NOTES="" CHECKS=1 DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --addon) ADDON="$2"; shift 2 ;;
    --companion) COMPANION="$2"; shift 2 ;;
    --skip-checks) CHECKS=0; shift ;;
    --dry-run) DRY=1; shift ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) NOTES="$1"; shift ;;
  esac
done
semver='^[0-9]+\.[0-9]+\.[0-9]+$'
die() { echo "release: $*" >&2; exit 1; }

[ -n "$NOTES" ] && [ -s "$NOTES" ] || die "give a non-empty release notes file"
for v in "$ADDON" "$COMPANION" "$VERSION"; do [ -z "$v" ] || [[ "$v" =~ $semver ]] || die "not a version: $v"; done

git fetch -q origin --tags
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "not on main"
[ -z "$(git status --porcelain)" ] || die "the working tree isn't clean"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main isn't in sync with origin/main"

if [ -z "$VERSION" ]; then
  last=$(git tag -l 'v*' --sort=-v:refname | head -1)
  [ -n "$last" ] || die "no previous tag: pass --version"
  IFS=. read -r ma mi pa <<<"${last#v}"
  VERSION="$ma.$mi.$((pa + 1))"
fi
TAG="v$VERSION"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "$TAG already exists"

TOC=addon/WowLocker/WowLocker.toc
cur_addon=$(sed -n 's/^## Version: *//p' "$TOC" | tr -d '\r')
cur_companion=$(sed -n 's/^var version = "\(.*\)"/\1/p' companion/main.go)
ADDON=${ADDON:-$cur_addon}
COMPANION=${COMPANION:-$cur_companion}

echo "release $TAG: addon $cur_addon → $ADDON, companion $cur_companion → $COMPANION, site → $VERSION"
[ "$DRY" = 1 ] && { echo "(dry run: nothing changed)"; exit 0; }

perl -pi -e "s/^## Version: .*/## Version: $ADDON/" "$TOC"
perl -pi -e "s/^var version = \".*\"/var version = \"$COMPANION\"/" companion/main.go
perl -pi -e "s/ADDON_VERSION = \".*\"/ADDON_VERSION = \"$ADDON\"/; s/COMPANION_VERSION = \".*\"/COMPANION_VERSION = \"$COMPANION\"/" apps/web/src/lib/downloads.ts
for pkg in package.json apps/web/package.json; do
  perl -pi -e "s/^  \"version\": \".*\"/  \"version\": \"$VERSION\"/" "$pkg"
done

if [ "$CHECKS" = 1 ]; then
  bun run typecheck
  bun run lint
  bun run test
  if command -v luajit >/dev/null; then luajit addon/test/sim.lua >/dev/null; else echo "warning: no luajit, addon sim skipped" >&2; fi
  if [ "$COMPANION" != "$cur_companion" ] && command -v go >/dev/null; then (cd companion && go vet ./... && go test ./...); fi
fi

git add -A
git commit -q -m "chore(release): $TAG"
git tag -a "$TAG" --cleanup=verbatim -F "$NOTES" # keep markdown headings
git push -q origin main "$TAG"
echo "pushed $TAG: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo salty-max/wow-locker)/actions"
