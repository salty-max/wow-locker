"""
The game's empty equipment-slot textures (Interface/PaperDoll/UI-PaperDoll-Slot-*)
as PNGs for the paper doll: apps/web/public/slots/<name>.png.

Blizzard's render CDN only serves the icon library, not interface textures, so
these come from wago.tools' copy of the game files (BLP) and are converted
with Pillow. Run once; the output is committed.

    python3 -m venv /tmp/v && /tmp/v/bin/pip install pillow
    /tmp/v/bin/python apps/web/scripts/paperdoll-slots.py
"""
import io
import os
import urllib.request

from PIL import Image

FILES = {  # FileDataID → name (interface/paperdoll/ui-paperdoll-slot-<name>.blp)
    136510: "ammo", 136511: "bag", 136512: "chest", 136513: "feet", 136514: "finger",
    136515: "hands", 136516: "head", 136517: "legs", 136518: "mainhand", 136519: "neck",
    136520: "ranged", 136521: "rear", 136522: "relic", 136523: "rfinger",
    136524: "secondaryhand", 136525: "shirt", 136526: "shoulder", 136527: "tabard",
    136528: "trinket", 136529: "waist", 136530: "wrists",
}

out = os.path.join(os.path.dirname(__file__), "..", "public", "slots")
os.makedirs(out, exist_ok=True)
for fdid, name in FILES.items():
    req = urllib.request.Request(f"https://wago.tools/api/casc/{fdid}?download", headers={"User-Agent": "WoWLocker slot textures"})
    blp = urllib.request.urlopen(req, timeout=30).read()
    img = Image.open(io.BytesIO(blp)).convert("RGBA")
    img.save(os.path.join(out, f"{name}.png"), optimize=True)
    print(f"{name:14} {img.size[0]}x{img.size[1]}")
