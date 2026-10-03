"""
apps/web/src/data/petIcons.json: the game's icon file id → icon name, for pet
icons. The addon only gets the icon as a file id (GetPetIcon, GetStablePetInfo);
Blizzard's render CDN serves icons by name. Covers hunter pet families
(ability_hunter_pet_*) and warlock demons (spell_shadow_summon*), from
wago.tools' listfile search.

    python3 apps/web/scripts/pet-icons.py
"""
import html
import json
import os
import re
import urllib.request

UA = {"User-Agent": "WoWLocker pet icons"}
TERMS = ["interface/icons/ability_hunter_pet_", "interface/icons/spell_shadow_summon"]
icons: dict[str, str] = {}
for term in TERMS:
    page = 1
    while True:
        url = f"https://wago.tools/files?search={term}&page={page}"
        body = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8")
        data = json.loads(html.unescape(re.search(r'data-page="([^"]+)"', body).group(1)))
        files = data["props"]["files"]
        for f in files["data"]:
            m = re.match(r"interface/icons/([a-z0-9_]+)\.blp$", f["filename"])
            if m:
                icons[str(f["fdid"])] = m.group(1)
        if page >= files.get("last_page", 1):
            break
        page += 1

out = os.path.join(os.path.dirname(__file__), "..", "src", "data", "petIcons.json")
with open(out, "w") as fh:
    json.dump(dict(sorted(icons.items(), key=lambda kv: int(kv[0]))), fh, indent=1)
print(f"{len(icons)} icons")
