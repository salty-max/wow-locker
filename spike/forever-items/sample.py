# Random gear ids for wowhead.py: uncommon or better, no test or NPC items.
# python3 sample.py era-items.jsonl [count] [seed] (13 October: 300, 13)
import json, random, re, sys
era = {}
for line in open(sys.argv[1]):
    r = json.loads(line); era[int(r["entry"])] = r
count = int(sys.argv[2]) if len(sys.argv) > 2 else 300
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 13
junk = re.compile(r"^(Monster -|Deprecated|Test|QA|OLD)|\(TEST\)|DEP$|Deprecated|\[PH\]", re.I)
gear = sorted(i for i in era if not junk.search(era[i]["name"]) and int(era[i]["class"]) in (2, 4)
              and int(era[i]["InventoryType"]) not in (0, 18, 24) and int(era[i]["Quality"]) >= 2)
print(",".join(str(i) for i in random.Random(seed).sample(gear, count)))
