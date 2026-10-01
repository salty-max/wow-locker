/**
 * Build the static talent-tree data the Battle.net API doesn't provide for
 * Classic (every talent/tree endpoint 404s there). Source: the game's own
 * DB2 tables, as exported by wago.tools for each branch.
 *
 *   bun run talents        → src/data/talents/{flavour}.json (commit the output)
 *
 * Re-run after a patch that changes talents. MoP Classic uses a different
 * talent system (rows of choices) and is not generated.
 */
type Row = Record<string, string>;

const BRANCHES = { classic1x: "wow_classic_era", classicann: "wow_anniversary" } as const;
const UA = { "User-Agent": "wow-locker talent generator (+https://github.com/salty-max/wow-locker)" };

function parseCsv(text: string): Row[] {
  // Small RFC 4180 parser: quoted fields may contain commas, quotes and newlines.
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

async function table(name: string, branch: string): Promise<Row[]> {
  const res = await fetch(`https://wago.tools/db2/${name}/csv?branch=${branch}`, { headers: UA });
  if (!res.ok) throw new Error(`${name}@${branch} → ${res.status}`);
  return parseCsv(await res.text());
}

// ClassID → our class keys (same as the API's playable-class ids).
const CLASS_KEYS: Record<number, string> = {
  1: "warrior", 2: "paladin", 3: "hunter", 4: "rogue", 5: "priest", 6: "deathknight",
  7: "shaman", 8: "mage", 9: "warlock", 10: "monk", 11: "druid",
};
const classFromMask = (mask: number) => {
  for (let id = 1; id <= 11; id++) if (mask === 1 << (id - 1)) return id;
  return 0;
};

for (const [flavour, branch] of Object.entries(BRANCHES)) {
  console.log(`\n${flavour} (${branch})`);
  const [talents, tabs] = await Promise.all([table("Talent", branch), table("TalentTab", branch)]);
  const spellIds = new Set<string>();
  for (const t of talents) for (let r = 0; r < 9; r++) if (t[`SpellRank_${r}`] !== "0") spellIds.add(t[`SpellRank_${r}`]);
  const [names, misc, manifest] = await Promise.all([
    table("SpellName", branch),
    table("SpellMisc", branch),
    table("ManifestInterfaceData", branch),
  ]);
  const nameOf = new Map(names.filter((n) => spellIds.has(n.ID)).map((n) => [n.ID, n.Name_lang]));
  const iconOf = new Map(misc.filter((m) => spellIds.has(m.SpellID)).map((m) => [m.SpellID, m.SpellIconFileDataID]));
  const file = new Map(manifest.map((m) => [m.ID, m.FileName.replace(/\.blp$/i, "").toLowerCase()]));

  const out: Record<string, { name: string; order: number; icon: string | null; talents: unknown[] }[]> = {};
  for (const tab of tabs) {
    const cls = CLASS_KEYS[classFromMask(Number(tab.ClassMask))];
    if (!cls) continue; // pet trees etc.
    const tTalents = talents
      .filter((t) => t.TabID === tab.ID)
      .map((t) => {
        const ranks = Array.from({ length: 9 }, (_, r) => t[`SpellRank_${r}`]).filter((x) => x && x !== "0");
        return {
          id: Number(t.ID),
          tier: Number(t.TierID),
          col: Number(t.ColumnIndex),
          max: ranks.length,
          name: nameOf.get(ranks[0]) ?? "",
          icon: file.get(iconOf.get(ranks[0]) ?? "") ?? null,
          req: Number(t.PrereqTalent_0) || null,
        };
      })
      .filter((t) => t.max > 0)
      .sort((a, b) => a.tier - b.tier || a.col - b.col);
    (out[cls] ??= []).push({ name: tab.Name_lang, order: Number(tab.OrderIndex), icon: file.get(tab.SpellIconID) ?? null, talents: tTalents });
  }
  for (const cls of Object.keys(out)) out[cls].sort((a, b) => a.order - b.order);
  const missingIcons = Object.values(out).flat().flatMap((t) => t.talents as { icon: string | null }[]).filter((t) => !t.icon).length;
  await Bun.write(new URL(`../src/data/talents/${flavour}.json`, import.meta.url), JSON.stringify(out));
  console.log(
    Object.entries(out).map(([c, trees]) => `${c}: ${trees.map((t) => `${t.name}(${t.talents.length})`).join(" ")}`).join("\n"),
    `\nmissing icons: ${missingIcons}`,
  );
}
