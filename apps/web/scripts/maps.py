"""
Zone maps for the location popup: apps/web/public/maps/<uiMapID>.webp, and
apps/web/src/data/maps.json (uiMapID → English name, the maps that exist).

A zone map is the game's world map art: 12 tiles of 256×256 (4 columns, 3 rows)
stitched and cropped to 1002×668, the size map coordinates (0–100 %) refer to,
fully explored: the base art is the unexplored parchment, and every area's
WorldMapOverlay (towns, roads, details) is drawn on top at its offset, as the
game does once you've discovered it.
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


maps: dict[str, dict] = {}  # uiMapID → {name, tiles: [(row, col, fdid)], overlays: [...]}
for branch in BRANCHES:
    ui = {r["ID"]: r for r in table("UiMap", branch)}
    art = {r["UiMapID"]: r["UiMapArtID"] for r in table("UiMapXMapArt", branch) if r["PhaseID"] == "0"}
    tiles: dict[str, list] = {}
    for r in table("UiMapArtTile", branch):
        if r["LayerIndex"] == "0":
            tiles.setdefault(r["UiMapArtID"], []).append((int(r["RowIndex"]), int(r["ColIndex"]), int(r["FileDataID"])))
    # Explored-area overlays: per map art, each a texture cut in 256 tiles.
    overlay_tiles: dict[str, list] = {}
    for r in table("WorldMapOverlayTile", branch):
        if r["LayerIndex"] == "0":
            overlay_tiles.setdefault(r["WorldMapOverlayID"], []).append((int(r["RowIndex"]), int(r["ColIndex"]), int(r["FileDataID"])))
    overlays: dict[str, list] = {}
    for r in table("WorldMapOverlay", branch):
        overlays.setdefault(r["UiMapArtID"], []).append({
            "w": int(r["TextureWidth"]), "h": int(r["TextureHeight"]),
            "x": int(r["OffsetX"]), "y": int(r["OffsetY"]),
            "tiles": overlay_tiles.get(r["ID"], []),
        })
    for map_id, row in ui.items():
        if row["Type"] != "3" or map_id not in art or map_id in maps:
            continue
        t = tiles.get(art[map_id], [])
        if len(t) == 12:  # the 4×3 zone layout
            maps[map_id] = {"name": row["Name_lang"], "tiles": t, "overlays": overlays.get(art[map_id], [])}

out = os.path.join(ROOT, "public", "maps")
os.makedirs(out, exist_ok=True)
for n, (map_id, m) in enumerate(sorted(maps.items(), key=lambda kv: int(kv[0])), 1):
    path = os.path.join(out, f"{map_id}.webp")
    if not os.path.exists(path):
        blp = lambda fdid: Image.open(io.BytesIO(get(f"https://wago.tools/api/casc/{fdid}?download"))).convert("RGBA")
        canvas = Image.new("RGBA", (1024, 768))
        for row, col, fdid in m["tiles"]:
            canvas.paste(blp(fdid), (col * 256, row * 256))
        # Every explored area on top. The last tile of a row/column is cropped to
        # the overlay's size (what the game's texcoords do).
        for o in m["overlays"]:
            for row, col, fdid in o["tiles"]:
                w, h = min(256, o["w"] - col * 256), min(256, o["h"] - row * 256)
                if w <= 0 or h <= 0:
                    continue
                piece = blp(fdid).crop((0, 0, w, h))
                canvas.alpha_composite(piece, (o["x"] + col * 256, o["y"] + row * 256))
        canvas.crop((0, 0, 1002, 668)).convert("RGB").save(path, "WEBP", quality=80, method=6)
    print(f"[{n}/{len(maps)}] {map_id} {m['name']}: {len(m['overlays'])} areas ({os.path.getsize(path) // 1024} KB)")

index = {map_id: m["name"] for map_id, m in sorted(maps.items(), key=lambda kv: int(kv[0]))}
with open(os.path.join(ROOT, "src", "data", "maps.json"), "w") as f:
    json.dump(index, f, indent=1, ensure_ascii=False)
print(f"{len(index)} maps")
