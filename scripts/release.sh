#!/usr/bin/env bash
# Cut a release: bump versions, check, commit, tag, push. GitHub Actions then
# builds and publishes it (.github/workflows/release.yml: the GitHub release,
# and CurseForge and Wago Addons when the addon changed), and Vercel deploys
# main.
#
#   scripts/release.sh [options] NOTES.md
#
#   NOTES.md            release notes (markdown): the tag's message, then the
#                       changelog on GitHub, CurseForge and Wago
#   --version X.Y.Z     the release (default: the latest tag's patch + 1)
#   --addon X.Y.Z       new addon version (addon/WowLocker/WowLocker.toc)
#   --hold              the GitHub release alone (repository variable
#                       HOLD_STORES); the stores later, by hand:
#                       gh workflow run release.yml -f tag=vX.Y.Z
#   --dry-run           show what would change, change nothing
#
# The site version (package.json, shown in Settings) follows the release.
# The companion app is Ravenpost now, released from salty-max/ravenpost: the
# download page finds its latest release (COMPANION_VERSION in
# apps/web/src/lib/downloads.ts is only shown until GitHub answers).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="" ADDON="" NOTES="" DRY=0 HOLD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --addon) ADDON="$2"; shift 2 ;;
    --hold) HOLD=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) NOTES="$1"; shift ;;
  esac
done
semver='^[0-9]+\.[0-9]+\.[0-9]+$'
die() { echo "release: $*" >&2; exit 1; }

[ -n "$NOTES" ] && [ -s "$NOTES" ] || die "give a non-empty release notes file"
for v in "$ADDON" "$VERSION"; do [ -z "$v" ] || [[ "$v" =~ $semver ]] || die "not a version: $v"; done

git fetch -q origin --tags
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "not on main"
[ -z "$(git status --porcelain)" ] || die "the working tree isn't clean"
FETCHED=$(git rev-parse origin/main)
[ "$(git rev-parse HEAD)" = "$FETCHED" ] || die "main isn't in sync with origin/main"

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
ADDON=${ADDON:-$cur_addon}

echo "release $TAG: addon $cur_addon → $ADDON, site → $VERSION$([ "$HOLD" = 1 ] && echo ", GitHub only (stores held)")"
# HOLD_STORES as it is (gh must answer: a release can't guess it).
held=$(gh variable list --json name,value -q '.[] | select(.name == "HOLD_STORES") | .value') ||
  die "gh can't read the repository's variables (gh auth status)"
[ "$DRY" = 1 ] && { echo "(dry run: nothing changed)"; exit 0; }

# From here, a stop before the push puts everything back.
pushed=0 touched=0
restore() {
  local code=$?
  [ "$code" = 0 ] || [ "$pushed" = 1 ] && return
  echo "release: stopped before the push, nothing published: putting the repository back" >&2
  git tag -d "$TAG" >/dev/null 2>&1 || true
  git reset -q --hard "$FETCHED"
  if [ "$touched" = 1 ]; then
    if [ "$held" = true ]; then gh variable set HOLD_STORES --body true >/dev/null || echo "release: put HOLD_STORES back by hand" >&2
    else gh variable delete HOLD_STORES >/dev/null 2>&1 || echo "release: put HOLD_STORES back by hand" >&2; fi
  fi
  exit "$code"
}
trap restore EXIT


perl -pi -e "s/^## Version: .*/## Version: $ADDON/" "$TOC"
perl -pi -e "s/ADDON_VERSION = \".*\"/ADDON_VERSION = \"$ADDON\"/" apps/web/src/lib/downloads.ts
for pkg in package.json apps/web/package.json; do
  perl -pi -e "s/^  \"version\": \".*\"/  \"version\": \"$VERSION\"/" "$pkg"
done

# The whole check on the bumped tree, the one pushed: q stamps it, and the
# pre-push hook refuses a tree without a stamp (so no way to skip it).
bun "$(git rev-parse --path-format=absolute --git-common-dir)/../../addon-kit/q.ts" check -- bun run check

git add -A
stamps="$(git rev-parse --path-format=absolute --git-common-dir)/harness"
[ -f "$stamps/check-$(git write-tree)" ] || die "the check didn't stamp the bumped tree (files changed while it ran?): run the release again"
git commit -q -m "chore(release): $TAG"
# origin's main still the one checked (an atomic push: main and the tag, or neither)
[ "$(git ls-remote origin refs/heads/main | cut -f1)" = "$FETCHED" ] || die "origin/main moved while the check ran: run the release again"
git tag -a "$TAG" --cleanup=verbatim -F "$NOTES" # keep markdown headings
# The stores held back or not: read by the release's workflow, so set first.
if [ "$HOLD" = 1 ]; then
  [ "$held" = true ] || { touched=1; gh variable set HOLD_STORES --body true >/dev/null; }
elif [ -n "$held" ]; then
  touched=1
  gh variable delete HOLD_STORES >/dev/null
fi
git push --atomic -q origin main "$TAG"
pushed=1
echo "pushed $TAG: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo salty-max/wow-locker)/actions"
