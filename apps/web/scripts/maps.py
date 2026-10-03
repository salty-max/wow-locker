"""
Zone maps for the location popup: apps/web/public/maps/<uiMapID>.webp, and
apps/web/src/data/maps.json (uiMapID → English name, the maps that exist).

A zone map is the game's world map art: 12 tiles of 256×256 (4 columns, 3 rows)
stitched and cropped to 1002×668, the size map coordinates (0–100 %) refer to.
Tables (UiMap, UiMapXMapArt, UiMapArtTile) come from wago.tools' DB2 exports,
for Classic Era and TBC Anniversary; tiles are the game's BLPs from wago.tools,
converted with Pillow. Zones and cities only (type 3): the addon's position is
always given on the zone's map. Run once; the output is committed.

    /tmp/v/bin/python apps/web/scripts/maps.py
"""
import csv
import io
import json
import os
import time
import urllib.request

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
BRANCHES = ["wow_classic_era", "wow_anniversary"]
UA = {"User-Agent": "WoWLocker maps"}


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)


def table(name: str, branch: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(get(f"https://wago.tools/db2/{name}/csv?branch={branch}").decode("utf-8"))))


maps: dict[str, dict] = {}  # uiMapID → {name, tiles: [(row, col, fdid)]}
for branch in BRANCHES:
    ui = {r["ID"]: r for r in table("UiMap", branch)}
    art = {r["UiMapID"]: r["UiMapArtID"] for r in table("UiMapXMapArt", branch) if r["PhaseID"] == "0"}
    tiles: dict[str, list] = {}
    for r in table("UiMapArtTile", branch):
        if r["LayerIndex"] == "0":
            tiles.setdefault(r["UiMapArtID"], []).append((int(r["RowIndex"]), int(r["ColIndex"]), int(r["FileDataID"])))
    for map_id, row in ui.items():
        if row["Type"] != "3" or map_id not in art or map_id in maps:
            continue
        t = tiles.get(art[map_id], [])
        if len(t) == 12:  # the 4×3 zone layout
            maps[map_id] = {"name": row["Name_lang"], "tiles": t}

out = os.path.join(ROOT, "public", "maps")
os.makedirs(out, exist_ok=True)
for n, (map_id, m) in enumerate(sorted(maps.items(), key=lambda kv: int(kv[0])), 1):
    path = os.path.join(out, f"{map_id}.webp")
    if not os.path.exists(path):
        canvas = Image.new("RGB", (1024, 768))
        for row, col, fdid in m["tiles"]:
            tile = Image.open(io.BytesIO(get(f"https://wago.tools/api/casc/{fdid}?download"))).convert("RGB")
            canvas.paste(tile, (col * 256, row * 256))
        canvas.crop((0, 0, 1002, 668)).save(path, "WEBP", quality=80, method=6)
    print(f"[{n}/{len(maps)}] {map_id} {m['name']} ({os.path.getsize(path) // 1024} KB)")

index = {map_id: m["name"] for map_id, m in sorted(maps.items(), key=lambda kv: int(kv[0]))}
with open(os.path.join(ROOT, "src", "data", "maps.json"), "w") as f:
    json.dump(index, f, indent=1, ensure_ascii=False)
print(f"{len(index)} maps")
