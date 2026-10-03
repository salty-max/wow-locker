#!/usr/bin/env bash
# Upload the addon zip to CurseForge (called by .github/workflows/curseforge.yml).
#   CF_API_TOKEN   CurseForge API token (curseforge.com → account → API tokens)
#   CF_PROJECT_ID  the CurseForge project id
#   $1             WowLocker-addon.zip     $2  changelog (markdown)
# Game versions come from the TOC's "## Interface:" list (11509 → 1.15.9,
# 20506 → 2.5.6). When CurseForge doesn't list that exact version yet, the
# newest one of the same line (1.15.x, 2.5.x) is used.
set -euo pipefail
ZIP="$1"
CHANGELOG="$2"
API="https://wow.curseforge.com/api"
: "${CF_API_TOKEN:?missing}" "${CF_PROJECT_ID:?missing}"

TOC=$(unzip -p "$ZIP" WowLocker/WowLocker.toc | tr -d '\r')
VERSION=$(sed -n 's/^## Version: *//p' <<<"$TOC")
INTERFACES=$(sed -n 's/^## Interface: *//p' <<<"$TOC" | tr ',' ' ')

VERSIONS=$(curl -fsS -H "X-Api-Token: $CF_API_TOKEN" "$API/game/versions")
IDS=()
for i in $INTERFACES; do
  major=$((i / 10000)); minor=$(((i / 100) % 100)); patch=$((i % 100))
  name="$major.$minor.$patch"
  id=$(jq -r --arg n "$name" '[.[] | select(.name == $n)][0].id // empty' <<<"$VERSIONS")
  if [ -z "$id" ]; then
    id=$(jq -r --arg p "$major.$minor." '[.[] | select(.name | startswith($p))] | sort_by(.name | split(".") | map(tonumber)) | last.id // empty' <<<"$VERSIONS")
    echo "::warning::CurseForge has no game version $name yet, using the newest $major.$minor.x"
  fi
  [ -n "$id" ] || { echo "::error::no CurseForge game version for interface $i"; exit 1; }
  IDS+=("$id")
done

METADATA=$(jq -n \
  --arg name "WoWLocker $VERSION" \
  --rawfile changelog "$CHANGELOG" \
  --argjson versions "$(printf '%s\n' "${IDS[@]}" | jq -s 'map(tonumber)')" \
  '{displayName: $name, changelog: $changelog, changelogType: "markdown", gameVersions: $versions, releaseType: "release"}')

curl -fsS -H "X-Api-Token: $CF_API_TOKEN" \
  -F "metadata=$METADATA" \
  -F "file=@$ZIP" \
  "$API/projects/$CF_PROJECT_ID/upload-file"
echo
echo "Uploaded WoWLocker $VERSION (game versions ${IDS[*]})"
