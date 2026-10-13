# Era (era_items.py's JSON lines) against Forever (client ItemSparse/Item,
# build 1.60.1.70291): what changed on the items both have.
# python3 tables.py era-items.jsonl ItemSparse.csv Item.csv out.json
import csv, json, sys, collections as C
era_path, sparse_path, item_path, out_path = sys.argv[1:5]
era = {}
for line in open(era_path):
    r = json.loads(line); era[int(r["entry"])] = r
fs = {int(r["ID"]): r for r in csv.DictReader(open(sparse_path, encoding="utf-8"))}
fi = {int(r["ID"]): r for r in csv.DictReader(open(item_path, encoding="utf-8"))}

# Mainline's ITEM_MOD ids (TrinityCore's ItemModType); classic's 0-7 agree.
MOD = {0:"mana",1:"health",3:"agility",4:"strength",5:"intellect",6:"spirit",7:"stamina",
12:"defense rating",13:"dodge rating",14:"parry rating",15:"block rating",16:"melee hit rating",
17:"ranged hit rating",18:"spell hit rating",19:"melee crit rating",20:"ranged crit rating",
21:"spell crit rating",28:"melee haste rating",29:"ranged haste rating",30:"spell haste rating",
31:"hit rating",32:"crit rating",35:"resilience",36:"haste rating",37:"expertise rating",
38:"attack power",39:"ranged attack power",40:"versatility",41:"bonus healing",42:"spell damage",
43:"mana regen (mp5)",44:"armor penetration rating",45:"spell power",46:"health regen",
47:"spell penetration",48:"block value",49:"mastery",50:"bonus armor",51:"fire resistance",
52:"frost resistance",53:"holy resistance",54:"shadow resistance",55:"nature resistance",
56:"arcane resistance",71:"agi/str/int",72:"agi/str",73:"agi/int",74:"str/int"}
Q = ["poor","common","uncommon","rare","epic","legendary","artifact","heirloom"]

def fstats(r):
    out = {}
    for i in range(10):
        t = int(r[f"StatModifier_bonusStat_{i}"]); p = int(r[f"StatPercentEditor_{i}"])
        if t >= 0 and p != 0:
            out[t] = out.get(t, 0) + p
    return out
def estats(r):
    out = {}
    for i in range(1, 11):
        t, v = int(r[f"stat_type{i}"]), int(r[f"stat_value{i}"])
        if v != 0:
            out[t] = out.get(t, 0) + v
    return out
def equip_spells(r):
    return [int(r[f"spellid_{i}"]) for i in range(1, 6) if int(r[f"spellid_{i}"]) and int(r[f"spelltrigger_{i}"]) == 1]

res = {"counts": {}, "changes": C.Counter(), "examples": C.defaultdict(list), "stat_types_forever": C.Counter(),
       "stat_types_era": C.Counter(), "new_by_class": C.Counter(), "new_by_quality": C.Counter()}
shared = sorted(set(era) & set(fs))
only_era = set(era) - set(fs); only_fv = set(fs) - set(era)
res["counts"] = {"era_items": len(era), "forever_sparse": len(fs), "forever_item": len(fi), "shared": len(shared),
                 "era_only": len(only_era), "forever_only": len(only_fv)}
equippable = lambda r: int(r["InventoryType"]) not in (0, 18, 24) # not bags/ammo/non-equip
def ex(key, iid, detail):
    if len(res["examples"][key]) < 12: res["examples"][key].append([iid, era[iid]["name"], detail])
ilvl_d = C.Counter(); price_ratio = []
for iid in shared:
    e, f = era[iid], fs[iid]
    name = e["name"]
    if int(e["Quality"]) != int(f["OverallQualityID"]):
        res["changes"]["quality"] += 1; ex("quality", iid, f'{Q[int(e["Quality"])]} -> {Q[int(f["OverallQualityID"])]}')
    if int(e["ItemLevel"]) != int(f["ItemLevel"]):
        res["changes"]["item level"] += 1; d = int(f["ItemLevel"]) - int(e["ItemLevel"]); ilvl_d[d] += 1
        ex("item level", iid, f'{e["ItemLevel"]} -> {f["ItemLevel"]}')
    if int(e["RequiredLevel"]) != int(f["RequiredLevel"]):
        res["changes"]["required level"] += 1; ex("required level", iid, f'{e["RequiredLevel"]} -> {f["RequiredLevel"]}')
    es, fsell = int(e["SellPrice"]), int(f["SellPrice"])
    if es != fsell:
        res["changes"]["sell price"] += 1; ex("sell price", iid, f'{es} -> {fsell} copper')
        if es > 0 and fsell > 0: price_ratio.append(fsell / es)
    if int(e["BuyPrice"]) != int(f["BuyPrice"]):
        res["changes"]["buy price"] += 1
    if int(e["bonding"]) != int(f["Bonding"]):
        res["changes"]["binding"] += 1; ex("binding", iid, f'{e["bonding"]} -> {f["Bonding"]}')
    if int(e["maxcount"]) != int(f["MaxCount"]):
        res["changes"]["unique (max count)"] += 1; ex("unique (max count)", iid, f'{e["maxcount"]} -> {f["MaxCount"]}')
    if int(e["stackable"]) != int(f["Stackable"]):
        res["changes"]["stack size"] += 1; ex("stack size", iid, f'{e["stackable"]} -> {f["Stackable"]}')
    if int(e["ContainerSlots"]) != int(f["ContainerSlots"]):
        res["changes"]["bag slots"] += 1; ex("bag slots", iid, f'{e["ContainerSlots"]} -> {f["ContainerSlots"]}')
    if int(e["itemset"]) != int(f["ItemSet"]):
        res["changes"]["item set id"] += 1; ex("item set id", iid, f'{e["itemset"]} -> {f["ItemSet"]}')
    if int(e["InventoryType"]) != int(f["InventoryType"]):
        res["changes"]["slot"] += 1; ex("slot", iid, f'{e["InventoryType"]} -> {f["InventoryType"]}')
    if iid in fi and (int(e["class"]), int(e["subclass"])) != (int(fi[iid]["ClassID"]), int(fi[iid]["SubclassID"])):
        res["changes"]["class/subclass"] += 1; ex("class/subclass", iid, f'{e["class"]}/{e["subclass"]} -> {fi[iid]["ClassID"]}/{fi[iid]["SubclassID"]}')
    if any(int(f[f"SocketType_{i}"]) for i in range(3)):
        res["changes"]["gained sockets"] += 1; ex("gained sockets", iid, [f[f"SocketType_{i}"] for i in range(3)])
    if int(f["ContentTuningID"]) or int(f["PlayerLevelToItemLevelCurveID"]):
        res["changes"]["scales with level"] += 1; ex("scales with level", iid, f'tuning {f["ContentTuningID"]} curve {f["PlayerLevelToItemLevelCurveID"]}')
    a, b = estats(e), fstats(f)
    for t in a: res["stat_types_era"][MOD.get(t, f"#{t}")] += 1
    for t in b: res["stat_types_forever"][MOD.get(t, f"#{t}")] += 1
    if set(a) != set(b) and (a or b):
        res["changes"]["stat types"] += 1
        ex("stat types", iid, f'{sorted(MOD.get(t,f"#{t}") for t in a)} -> {sorted(MOD.get(t,f"#{t}") for t in b)}')
    eq = equip_spells(e)
    if eq: res["changes"]["era equip effects (any)"] += 1
    rating = {31,32,36,37,41,42,43,44,45,47,48,38,39,12,13,14,15} & set(b)
    if eq and rating:
        res["changes"]["era equip effect, forever rating/power stat"] += 1
        ex("era equip effect, forever rating/power stat", iid, f'equip spells {eq} -> {sorted(MOD.get(t,f"#{t}") for t in rating)}')
    if int(e["RandomProperty"]):
        res["changes"]["era random enchant (of the X)"] += 1
    if int(e["class"]) in (2, 4) and equippable(e) and int(e["Quality"]) >= 2 and not a and not eq and not int(e["RandomProperty"]) and b:
        res["changes"]["statless in era, stats in forever"] += 1; ex("statless in era, stats in forever", iid, sorted(MOD.get(t,f"#{t}") for t in b))
for iid in only_fv:
    r = fs[iid]; it = fi.get(iid)
    res["new_by_class"][it["ClassID"] if it else "?"] += 1
    res["new_by_quality"][Q[int(r["OverallQualityID"])] if int(r["OverallQualityID"]) < 8 else r["OverallQualityID"]] += 1
res["ilvl_delta"] = sorted(ilvl_d.items())
price_ratio.sort()
if price_ratio:
    n = len(price_ratio); res["sell_ratio"] = {"n": n, "p10": price_ratio[n//10], "median": price_ratio[n//2], "p90": price_ratio[9*n//10],
        "up": sum(x > 1 for x in price_ratio), "down": sum(x < 1 for x in price_ratio)}
json.dump(res, open(out_path, "w"), indent=1, default=list)
print(json.dumps({k: res[k] for k in ("counts", "changes", "sell_ratio", "new_by_class", "new_by_quality")}, indent=1))
print("forever stat types:", res["stat_types_forever"].most_common())
print("era stat types:", res["stat_types_era"].most_common())
