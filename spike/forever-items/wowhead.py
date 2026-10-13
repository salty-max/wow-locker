# Wowhead tooltips for a sample of items, Classic Era and Forever, as text.
# python3 wowhead.py out.json 1,2,3 (ids; sample.py gives random ones). Polite: 0.4 s a request.

import json, re, sys, time, urllib.request, html
out = sys.argv[1]
ids = [int(x) for x in sys.argv[2].split(",")]
def text(tip):
    t = re.sub(r"<br\s*/?>|</tr>|</div>|</table>", "\n", tip)
    t = re.sub(r"<!--.*?-->", "", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    lines = [re.sub(r"\s+", " ", l).strip() for l in t.split("\n")]
    return [l for l in lines if l]
res = {}
for i in ids:
    res[i] = {}
    for env in ("classic", "forever"):
        req = urllib.request.Request(f"https://nether.wowhead.com/{env}/tooltip/item/{i}", headers={"User-Agent": "Mozilla/5.0"})
        try:
            d = json.load(urllib.request.urlopen(req, timeout=20))
            res[i][env] = {"name": d.get("name"), "quality": d.get("quality"), "lines": text(d.get("tooltip", ""))}
        except Exception as e:
            res[i][env] = {"error": str(e)[:80]}
        time.sleep(0.4)
json.dump(res, open(out, "w"), indent=1)
print(len(res), "items")
