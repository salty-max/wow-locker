# Classic Era stand-in: cmangos classic-db's item_template (patch 1.12) as JSON
# lines. python3 era_items.py classicdb.sql era-items.jsonl (the dump: hearthtale's
# .cache/audit/classicdb.sql). Replace with Era's own ItemSparse once wago is up.
import json, re, sys
sql, out = sys.argv[1], sys.argv[2]
text = open(sql, encoding="utf-8", errors="replace").read()
m = re.search(r"CREATE TABLE `item_template` \((.*?)\n\)", text, re.S)
cols = re.findall(r"^\s*`(\w+)`", m.group(1), re.M)
def rows(s):
    i, n = 0, len(s)
    while i < n:
        if s[i] == "(":
            i += 1; vals = []; cur = []; inq = False
            while i < n:
                c = s[i]
                if inq:
                    if c == "\\": cur.append(s[i+1]); i += 2; continue
                    if c == "'":
                        if i + 1 < n and s[i+1] == "'": cur.append("'"); i += 2; continue
                        inq = False; i += 1; continue
                    cur.append(c); i += 1; continue
                if c == "'": inq = True; i += 1; continue
                if c == ",": vals.append("".join(cur)); cur = []; i += 1; continue
                if c == ")": vals.append("".join(cur)); i += 1; break
                cur.append(c); i += 1
            yield vals
        else:
            i += 1
count = 0
with open(out, "w") as f:
    for ins in re.finditer(r"INSERT INTO `item_template` VALUES (.*?);\n", text, re.S):
        for vals in rows(ins.group(1)):
            if len(vals) != len(cols):
                continue
            f.write(json.dumps(dict(zip(cols, vals))) + "\n"); count += 1
print(len(cols), "columns,", count, "items")
print(cols)
