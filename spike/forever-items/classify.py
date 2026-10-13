# Classify what changed between Classic and Forever tooltips (Wowhead text).
# python3 classify.py out.json (from wowhead.py)

import json, re, sys, collections as C
r = json.load(open(sys.argv[1]))
def money(line):
    n = [int(x) for x in re.findall(r"\d+", line)]
    c = 0
    for k, v in zip((1, 100, 10000), reversed(n)): c += k * v
    return c
def norm(s):
    s = s.lower().replace(" .", ".")
    s = re.sub(r"(\d+)\.0%", r"\1%", s)
    s = s.replace("increased ", "") if re.match(r"equip: increased (mining|herbalism|skinning|fishing)", s) else s
    return s
def parse(lines):
    d = {"stats": {}, "equip": set(), "use": set(), "set": set()}
    for l in lines:
        if m := re.search(r"Item Level (\d+)", l): d["ilvl"] = int(m[1])
        if m := re.search(r"Requires Level (\d+)", l): d["req"] = int(m[1])
        if m := re.match(r"^(\d+) Armor$", l): d["armor"] = int(m[1])
        if m := re.search(r"(\d+) - (\d+) Damage", l): d["dmg"] = (int(m[1]), int(m[2]))
        if m := re.search(r"\(([\d.]+) damage per second\)", l): d["dps"] = float(m[1])
        if m := re.match(r"^\+ ?(\d+) ([A-Za-z ]+)$", l): d["stats"][m[2].strip().lower()] = int(m[1])
        if l.startswith("Equip:"): d["equip"].add(norm(l))
        if l.startswith(("Use:", "Chance on hit:")): d["use"].add(norm(l))
        if re.match(r"^\(\d\) Set", l): d["set"].add(norm(l))
        if l.startswith("Sell Price"): d["sell"] = money(l)
        if m := re.search(r"Durability (\d+)", l): d["dur"] = int(m[1])
    return d
out = C.Counter(); ex = C.defaultdict(list); ilvl = C.Counter(); statratio = []; armorratio = []; sellratio = []; dpsratio = []
total = missing = 0
for i, d in r.items():
    total += 1
    c, f = d.get("classic", {}), d.get("forever", {})
    if "error" in c: out["classic missing"] += 1; continue
    if "error" in f: missing += 1; ex["not in forever (wowhead)"].append(c["name"]); continue
    a, b = parse(c["lines"]), parse(f["lines"])
    changed = []
    if c["quality"] != f["quality"]: changed.append("quality")
    for k in ("ilvl", "req", "armor", "dmg", "sell", "dur"):
        if a.get(k) != b.get(k): changed.append(k)
    if a["stats"] != b["stats"]: changed.append("stats (+N lines)")
    if a["equip"] != b["equip"]: changed.append("equip effects")
    if a["use"] != b["use"]: changed.append("use/proc")
    if a["set"] != b["set"]: changed.append("set bonuses")
    if not changed: out["unchanged"] += 1
    else: out["changed"] += 1
    for k in changed:
        out["field: " + k] += 1
        if len(ex[k]) < 5: ex[k].append(c["name"])
    if "ilvl" in a and "ilvl" in b: ilvl[b["ilvl"] - a["ilvl"]] += 1
    sa, sb = sum(a["stats"].values()), sum(b["stats"].values())
    if sa: statratio.append(sb / sa)
    if a.get("armor") and b.get("armor"): armorratio.append(b["armor"] / a["armor"])
    if a.get("sell") and b.get("sell"): sellratio.append(b["sell"] / a["sell"])
    if a.get("dps") and b.get("dps"): dpsratio.append(b["dps"] / a["dps"])
def q(x):
    x = sorted(x); n = len(x)
    return {"n": n, "p10": round(x[n//10], 2), "median": round(x[n//2], 2), "p90": round(x[9*n//10], 2), "below": sum(v < 0.995 for v in x), "above": sum(v > 1.005 for v in x)} if x else {}
print("sampled", total, "| not in forever on wowhead", missing)
for k, v in sorted(out.items()): print(f"  {k}: {v}")
print("ilvl delta:", sorted(ilvl.items()))
print("+N stat totals ratio:", q(statratio))
print("armor ratio:", q(armorratio))
print("sell price ratio:", q(sellratio))
print("weapon dps ratio:", q(dpsratio))
for k, v in ex.items(): print(" ex", k, ":", v[:12] if k.startswith("not") else v)
