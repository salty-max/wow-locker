"""
Game interface textures used by the web app, as PNGs under apps/web/public/:

  slots/<name>.png      empty equipment slots (Interface/PaperDoll/UI-PaperDoll-Slot-*)
  slots/bag-empty.png   an empty bag slot, cut out of Interface/ContainerFrame/UI-Bag-4x4
  ui/cursor-point.png   the mouse cursor (Interface/Cursor/Point), + @2x for Retina
  ui/xp-frame.png       the XP bar's frame and 20 bubbles, assembled like the game does
                        from four strips of MainMenuBar/UI-MainMenuBar-Dwarf
  ui/statusbar.png      the XP bar fill (TargetingFrame/UI-StatusBar), tinted in CSS
  ui/exhaustion-tick.png  the rested XP marker (MainMenuBar/UI-ExhaustionTickNormal)
  ui/skill-bar.png      skill / reputation bar fill (PaperDollInfoFrame/UI-Character-Skills-Bar)
  ui/skill-border.png   their border (UI-Character-Skills-BarBorder), trimmed for a 9-slice

Blizzard's render CDN only serves the icon library, not interface textures, so
these come from wago.tools' copy of the game files (BLP) and are converted
with Pillow. Run once; the output is committed.

    python3 -m venv /tmp/v && /tmp/v/bin/pip install pillow
    /tmp/v/bin/python apps/web/scripts/ui-textures.py
"""
import io
import os
import struct
import urllib.request

from PIL import Image, ImageDraw

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")

SLOTS = {  # FileDataID → name (interface/paperdoll/ui-paperdoll-slot-<name>.blp)
    136510: "ammo", 136511: "bag", 136512: "chest", 136513: "feet", 136514: "finger",
    136515: "hands", 136516: "head", 136517: "legs", 136518: "mainhand", 136519: "neck",
    136520: "ranged", 136521: "rear", 136522: "relic", 136523: "rfinger",
    136524: "secondaryhand", 136525: "shirt", 136526: "shoulder", 136527: "tabard",
    136528: "trinket", 136529: "waist", 136530: "wrists",
}
BAG_4X4 = 130998  # interface/containerframe/ui-bag-4x4.blp
BAG_SLOT_BOX = (82, 49, 118, 85)  # the top-left recessed slot, inside the bag's metal grid (36×36)
CURSOR_POINT = 131028  # interface/cursor/point.blp
MAIN_MENU_BAR = 136407  # interface/mainmenubar/ui-mainmenubar-dwarf.blp
# The XP frame's four 256×10 strips, left to right (TexCoords in Classic/StatusTrackingBar.xml).
XP_STRIPS = [(0.79296875, 0.83203125), (0.54296875, 0.58203125), (0.29296875, 0.33203125), (0.04296875, 0.08203125)]
STATUS_BAR = 137012  # interface/targetingframe/ui-statusbar.blp
EXHAUSTION_TICK = 136390  # interface/mainmenubar/ui-exhaustionticknormal.blp
SKILL_BAR = 136570  # interface/paperdollinfoframe/ui-character-skills-bar.blp
SKILL_BORDER = 136571  # interface/paperdollinfoframe/ui-character-skills-barborder.blp
SKILL_BORDER_BOX = (2, 6, 255, 25)  # the border itself, ~5 px thick


def fetch(fdid: int) -> bytes:
    req = urllib.request.Request(f"https://wago.tools/api/casc/{fdid}?download", headers={"User-Agent": "WoWLocker textures"})
    return urllib.request.urlopen(req, timeout=30).read()


def palette_1bit(blp: bytes) -> Image.Image:
    """BLP2, palettized with a 1-bit alpha mask (the cursors): Pillow reads its alpha as empty."""
    w, h = struct.unpack("<II", blp[12:20])
    off = struct.unpack("<I", blp[20:24])[0]
    palette = [blp[148 + i * 4 : 152 + i * 4] for i in range(256)]  # BGRA
    n = w * h
    index, mask = blp[off : off + n], blp[off + n : off + n + n // 8]
    img = Image.new("RGBA", (w, h))
    for i in range(n):
        b, g, r, _ = palette[index[i]]
        img.putpixel((i % w, i // w), (r, g, b, 255 if (mask[i // 8] >> (i % 8)) & 1 else 0))
    return img


def round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Transparent rounded corners (drawn 4× and downsampled), so no grid rivet shows."""
    k = 4
    mask = Image.new("L", (img.width * k, img.height * k), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width * k - 1, img.height * k - 1), radius=radius * k, fill=255)
    out = img.copy()
    out.putalpha(Image.composite(img.getchannel("A"), Image.new("L", img.size, 0), mask.resize(img.size, Image.LANCZOS)))
    return out


def save(img: Image.Image, *path: str) -> None:
    full = os.path.join(PUBLIC, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full, optimize=True)
    print(f"{os.path.join(*path):28} {img.size[0]}x{img.size[1]}")


for fdid, name in SLOTS.items():
    save(Image.open(io.BytesIO(fetch(fdid))).convert("RGBA"), "slots", f"{name}.png")

bag = Image.open(io.BytesIO(fetch(BAG_4X4))).convert("RGBA")
save(round_corners(bag.crop(BAG_SLOT_BOX), 4), "slots", "bag-empty.png")

cursor = palette_1bit(fetch(CURSOR_POINT))
save(cursor, "ui", "cursor-point.png")
save(cursor.resize((cursor.width * 2, cursor.height * 2), Image.NEAREST), "ui", "cursor-point@2x.png")
# The hotspot: the opaque pixel nearest the top-left corner (the fingertip).
hot = min(((x + y, x, y) for y in range(cursor.height) for x in range(cursor.width) if cursor.getpixel((x, y))[3]), default=(0, 0, 0))
print(f"cursor hotspot: {hot[1]} {hot[2]}")

def blp(fdid: int) -> Image.Image:
    return Image.open(io.BytesIO(fetch(fdid))).convert("RGBA")


menu = blp(MAIN_MENU_BAR)
xp = Image.new("RGBA", (1024, 10))
for i, (top, bottom) in enumerate(XP_STRIPS):
    xp.paste(menu.crop((0, round(top * 256), 256, round(bottom * 256))), (i * 256, 0))
save(xp, "ui", "xp-frame.png")
save(blp(STATUS_BAR), "ui", "statusbar.png")
save(blp(EXHAUSTION_TICK), "ui", "exhaustion-tick.png")
save(blp(SKILL_BAR), "ui", "skill-bar.png")
save(blp(SKILL_BORDER).crop(SKILL_BORDER_BOX), "ui", "skill-border.png")
