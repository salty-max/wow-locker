# WoWLocker on World of Warcraft: Forever

> **Plan for launch (4 November 2026), revised 13 October 2026.** Two ways
> in, decided at launch by one probe: if Battle.net opens a Forever
> namespace, Forever characters come from the API like Classic ones; if it
> doesn't, from the addon through Ravenpost, owned by a link code typed in
> the game (Hearthtale's way). Most of the work serves both and comes first:
> the addon's port (WoWLocker's addon feeds deaths, quests, sessions, bags
> and mail on Classic too), the trait trees, Forever's stats and items. The
> 13 October revision adds a comparison of Classic's items with Forever's
> (below): a third of the old gear still in the game changed, and half of
> the old gear isn't in the client's static tables at all.

Forever (beta since 17 September 2026, launch 4 November 2026) is the original
Azeroth on the modern Mainline client, with reworked talents and items.

## What Forever changes for us

Checked 5 October (client data, API probes), 7 October in the real client
with Hearthtale (Forever beta, realm "Classic Beta PvP"), and 13 October
(Forever's UI source, Gethe/wow-ui-source branch `forever`; Wowhead; the
client tables).

- **No Battle.net API yet.** `spike/FINDINGS.md` (1 October): no Forever
  namespace, every guess answers like a nonsense one. Blizzard has never
  served an API for a beta or a PTR, and nothing is announced: the API
  forum's thread on it (18 September) has no Blizzard answer, and the
  third-party "Forever armories" wait for the same thing. So the API can't
  be tested before launch, whichever way it goes.
- **Realmless.** Forever has rulesets instead of realms (Normal, PvP,
  Roleplay at launch, Hardcore later) and a full name (first name and
  surname) unique in a region (Blizzard's names article). Collections are
  shared across the rulesets but Hardcore's.
- **Names: a first name and a surname.** `UnitName(unit)` returns the
  surname as its second value, where other clients return the realm
  ("Hellefie", "Namzan"); `GetUnitName("player")` gives "Hellefie Namzan",
  the realm comes from `GetRealmName()`. Reading
  `name, realm = UnitName("player")` saves the surname as the realm
  (AllTheThings issue #2630 made that mistake).
- **Races and classes.** Skyborne is two races, High Order Skyborne
  (warrior, hunter, rogue, mage, druid) and Windshaper Skyborne (warrior,
  hunter, rogue, shaman, druid), and old races get new classes: human
  hunter, orc mage, dwarf shaman, undead paladin, gnome priest, troll
  warlock (CharBaseInfo: 56 race and class pairs, Classic Era 40). The site
  shows the names it's given, so nothing to draw; the tests and the
  simulation should cover a Skyborne and an undead paladin.
- **Talents are trait trees.** Forever's client data (wago.tools
  `wow_classic_beta`, build 1.60.1.70205) keeps the 27 classic TalentTabs, but
  its talents are 17 Mainline-style trait trees (TraitTree, TraitNode,
  TraitNodeEntry, TraitDefinition, TraitCond, TraitEdge): positioned nodes,
  edges, ranks, choice nodes, with later-era abilities (Riptide, Lava Burst,
  Wild Growth, Mutilate, Bane of Havoc). Three of them are account-wide perk
  trees (Thrill of Adventure, Bartering, Master Chef…). The addon reads them
  with `C_ClassTalents` / `C_Traits`.
- **Items:** re-statted, partly delivered by hotfixes: see "Items" below.
- **Character stats** (Forever's character sheet, `PaperDollFrameConstants`
  under `Camelot/`): health, power, movement speed; strength, agility,
  stamina, intellect, spirit; main hand, off hand and ranged damage, attack
  power, ranged attack power; hit chance, crit chance, haste, expertise,
  armor penetration, spell power, bonus healing, spell penetration;
  defense, dodge, block, parry, armor. Hit is a rating plus a modifier per
  kind (`GetCombatRatingBonus(CR_HIT_MELEE) + GetHitModifier()`, ranged,
  spell), crit one chance per kind, expertise per hand. WoWLocker's
  `Stats` holds health, power, the five stats, armor, attack power, spell
  power, melee and spell crit, dodge: it needs the rest.
- **Hunter pets:** Cataclysm's stable (`Cata/PetStable.lua`): 5 active
  pets, 200 stable slots; `GetStablePetInfo` (still there) returns icon,
  name, level, family and talent spec. No loyalty, no training points:
  the site's pet panel already hides them when missing.
- **Mounts are account-wide:** "Mount (Account-wide)", "Use: Teaches you
  how to summon this mount"; the item goes, the journal keeps it.
- **Addon API (Midnight rules):** no combat log for addons (registering it
  throws: Hearthtale counts kills from the corpses of what it fought);
  secret values (health, auras, some unit data) in boss encounters and
  Mythic+; Classic globals gone: `GetItemInfo` (confirmed: a Lua error in
  Hearthtale 0.5.0), `GetSpellInfo`, `GetNumTalentTabs`/`GetTalentInfo`,
  `GetNumSkillLines`/`GetSkillLineInfo`, likely
  `GetQuestLogTitle`/`GetNumQuestLogEntries`, `GetFactionInfo`,
  `GetItemCooldown`. (`GetStablePetInfo` stays: Forever's stable calls it.)
- **Items not loaded yet** (confirmed): `C_Item.GetItemInfo` returns nothing
  for an item the client hasn't loaded, so its quality comes from the link's
  colour (`|cff1eff00`, or `|cnIQ2:`). A quest objective for such an item
  comes without its name ("0/8 ") until the item is loaded.
- **Game strings with numbered blanks** (confirmed): `QUEST_OBJECTS_FOUND` is
  like `"%2$d/%3$d %1$s"` ("0/8 Tough Wolf Meat"): patterns built from it
  must keep each blank's argument number.
- **At login the zone may not be known yet** (confirmed): `GetRealZoneText`
  is empty for a few seconds; what is recorded "at login" must wait for it.
- **Game folder:** `_forever_` for the live game (first seen at the
  stress test, 23 October 2026; Ravenpost labels it "World of Warcraft:
  Forever"), `_classic_beta_` for the beta ("World of Warcraft: Forever
  (beta)"). The folder doesn't pick the TOC: the client is game type Camelot
  (`_Camelot.toc`, interface 16001 on 1.60.1). Under `WTF/Account/<account>/` the realm folder is a number
  ("70"), the character folders are "First-Surname" ("Hellefie-Namzan").
  The game keeps a deleted character's folder.

## Items: Classic Era against Forever

Compared 13 October. Sources:

- Forever's client tables, ItemSparse and Item, build 1.60.1.70291
  (wago.tools, downloaded 9 October).
- For Classic Era, cmangos' classic-db `item_template` (patch 1.12, which
  Era's items follow), since wago.tools was down for maintenance that day.
  It stands in for Era's own table: small differences are possible, and
  the table comparison should be run again on Era's own table.
- Wowhead's tooltips for both games (`nether.wowhead.com/{classic,forever}/
  tooltip/item/<id>`), which include the server's hotfixes: 70 picked
  items, and 300 random gear pieces of uncommon quality or better.

The scripts are in `spike/forever-items/`.

**Half the old gear isn't in Forever's static item table.** Of Classic's
9,616 pieces of gear, 4,746 have a row in ItemSparse; 4,865 are in Item
only, their data sent by the server as hotfixes (most likely how Blizzard
holds back changed and unreleased items); 5 are in neither. A static row can
also be stale: Smotts' Compass's row keeps Classic's sell price, while the
game (per Wowhead) sells it for 93s 47c and gives it a new Use. So nothing
about an item's stats may be built from the client tables: tooltips come
from the game or from the API.

**Not all of Classic is in the beta.** 67 of the 300 random pieces (22%)
are unknown to Wowhead's Forever data and missing from the client tables:
mostly raid, PvP and level-60 dungeon gear (Edgemaster's Handguards, Hand
of Justice, Tier 1 and 2 pieces). Cut, or held back for later: we can't tell
before launch.

**A third of the rest changed.** Of the 230 sampled pieces in both games,
157 (68%) are identical and 73 (32%) changed something. What changed, out of
230: stats 42, "Equip:" effects 40, sell price 23 (17 up, 5 down), set
bonuses 14, armor 11, durability 11 (mostly PvP gear), weapon damage 10,
item level 9, required level 5, procs and Use 4, quality 3. The amounts
move little on the whole: the totals of "+N" stats keep a median ratio of
1.0 (from 0.92 to 1.19 for the middle 80%), armor and weapon DPS too.

What the changes look like:

- **"Equip:" bonuses became stats.** 1,152 items of the static table had an
  equip effect in 1.12 and carry a rating or power stat in Forever: hit,
  crit, spell power, attack power, defense, dodge. The tooltip still reads
  "Equip: Improves your chance to hit by 2.0%" (with a decimal now). Forever
  adds stats for school damage (fire, frost, shadow, arcane, nature, likely
  holy),
  damage against a creature type, and profession skills (ItemSparse stat
  ids 83 to 136; their meaning inferred from the items that carry them).
- **Bonus healing gives damage too:** "Increases healing done by up to 42
  and damage done by up to 14 for all magical spells and effects" (Hide of
  the Wild). Stormcloth Vest: 29 healing became 58 healing and 10 damage.
- **Spirit traded for spell power** on caster gear (Minor Channeling Ring,
  Runic Leather Belt, Harvester's Robe).
- **Weapon skill became expertise:** Dwarven Tree Chopper, "Increased
  Two-handed Axes +2" became "Reduces chance to be Dodged or Parried by
  0.6%".
- **Creature-type bonuses split:** Beastsmasher, "+30 Attack Power when
  fighting Beasts" became "+16 Attack Power" and "+15 Attack Power against
  Beasts".
- **Caster weapons:** less weapon damage, spell power added (Crescent Staff
  47-71 became 35-53 with 26 spell power); some get a place: Staff of
  Westfall, movement speed +2% in Elwynn Forest, Westfall, Redridge and the
  Deadmines.
- **Early dungeon gear** one or two levels lower (Blackened Defias Armor:
  item level 24 to 22, required level 19 to 17); Wailing Caverns' Fang
  pieces green to blue, with more stats.
- **Sets:** bonuses rewritten (Defias Leather, Embrace of the Viper), new sets
  (Stormcloth Regalia).
- **Crafted low-level gear** white to green, with stats, bind on equip
  (Handstitched Leather Pants, Studded Blackjack).
- **Smaller ones:** Strong Fishing Pole +5 fishing to +45; Thunderfury
  loses its 16-30 Nature damage per Wowhead (Mainline weapons deal one kind
  of damage), 53.95 DPS to 41.84; Smotts' Compass gains a Use.
- **New items:** 4,963 item ids new in Forever's static table (5 October,
  against Era's own table), mostly quest items, recipes, consumables and
  gear, and more among the hotfixed rows.
- **No scaling, no sockets** in the static rows: no ContentTuning, no
  level curve, no socket. Random enchantments remain ("<Random
  enchantment>" on Archaedic Stone).

What it means for WoWLocker:

- **Tooltips from the API or the game, never from tables.** With the API:
  the equipment endpoint and the static item API in Forever's namespace, as
  for Classic. Without it: `C_TooltipInfo` in the game, uploaded.
- **Cached per flavour** (`item_tooltips` and `item_icons` are keyed on
  region, flavour, item id): a Classic tooltip is never shown for a Forever
  item. From the addon, the key is the item string without its per-copy
  parts (item id, enchant, random enchantment), since one id can carry
  different stats.
- **Set bonuses in the tooltip:** WoWLocker drops the set lines today; with
  Forever's sets rewritten, it shows the set's name, pieces and bonuses
  (the equipment endpoint's `set`; the game's tooltip lines).
- **Stats:** `Stats` grows the character sheet's other fields (hit, haste,
  expertise, armor penetration, bonus healing, spell penetration, defense,
  parry, block, ranged crit), shown when present.
- **Icons:** without the API, the addon sends icon file ids, mapped to icon
  names for the render CDN (as `scripts/pet-icons.py` does for pets);
  whether the CDN serves Forever's new icons is checked at launch.

## Decisions

| Question | Decision |
|---|---|
| Data source | **Battle.net if a Forever namespace opens at launch** (one probe, not a polling loop): ownership, gear, stats and talents as for Classic. **The addon otherwise**, and an API adapter later if a namespace comes. |
| Ownership (addon only) | **A link code, as Hearthtale.** Signed in on wow-locker.app, the player gets a six-letter code (one use, thirty minutes) and types `/wl link CODE` in the game; the addon keeps it in its saved file, and the upload that carries it attaches the character to that account. Without a code, a Forever character uploads as "unlinked", and Ravenpost says how to link it. |
| Character identity | The GUID (realm id + character id), as today; shown with its full name, the realm from `GetRealmName()`. With the API, the GUID's match with the API's character id is checked again (it held for Classic, 2 October). |
| Talents | **Full trait trees**, drawn from Forever's client data, filled from the API's loadout or the addon's talent snapshot. Since items come partly through hotfixes, talents may too: the addon's snapshot (node ids, entries) is checked against the tree data, and an unknown node is reported, not dropped. |
| Item stats | **Tooltips from the API or the game** (see "Items"), never from client tables. |
| First release | **Core first:** character, level, gear with tooltips and sets, talents, stats, deaths, quests, sessions. Bags, bank, mail, cooldowns, reputations, professions, pets and the new zones' maps follow. |
| Deleted characters | Ravenpost hides what the site calls "gone". Without the API there is no Battle.net list: a full name played again makes the older character gone, as for Classic since 7 October. |

## Work for launch

### Both ways

The addon (`addon/WowLocker`):

1. **Two packages, one source** (as Hearthtale and Lorekeeper's Codex):
   Classic TOC `11509, 20506`, Forever TOC `16001`; the code checks the game
   (`GetBuildInfo`, interface 16xxx) only where the APIs disagree, and
   otherwise uses whichever API exists.
2. **Names:** the full name for the character (`UnitName`'s second value is a
   surname on Forever, a realm elsewhere), the realm from `GetRealmName()`.
3. **No combat log on Forever:** not registered. Kills from the corpses of
   what was fought (Hearthtale's way); deaths and close calls keep level,
   place and time, the killer when it was the target. The pet's death comes
   from `UNIT_HEALTH` on `pet`.
4. **Secret values:** the player's health is secret even out of combat
   (Second Wind measured it, 11 October): close calls come from the game's
   low-health warning, which addons see (below 35%, where Classic's are
   below 15%), as Second Wind does; deaths' details from the death recap.
   Anything else secret is checked before use.
5. **Modern APIs:** `C_Item.GetItemInfo` (nil until loaded: quality from the
   link's colour; names read again until loaded), `C_Spell.GetSpellInfo`,
   `C_QuestLog` (numbered blanks; names possibly missing at first),
   `C_Reputation`, professions, `C_Container`; the stable's
   `GetStablePetInfo` with the talent spec in place of loyalty.
6. **Simulation:** a test client that behaves like today's: no combat log,
   secret values, only the C_ APIs, items not loaded until asked for,
   numbered game strings, surnames, no zone at login, a Skyborne and an
   undead paladin (Hearthtale's `addon/test/game.lua` does most of it
   already).

Ravenpost:

7. ✅ Label Forever's live folder: `_forever_` (23 October 2026), beside the
   beta's `_classic_beta_`.

The API and the site:

8. **Flavour `forever`** in `@wow-locker/shared`, its namespace left empty
   until launch.
9. **Trait tree data:** `scripts/talents.ts` extended for Forever (wago.tools,
   pinned build): trees, nodes with positions, edges, entries, ranks, choice
   nodes, icons (SpellMisc + ManifestInterfaceData). Committed as
   `src/data/talents/forever.json`; checked again against the launch build.
10. **Trait tree view:** nodes placed by PosX/PosY, edges, ranks, choices, the
    account perk trees apart.
11. **Stats:** the character sheet's other fields in `Stats` (shared, both
    sources), the panel showing what it has.
12. **Set bonuses** in `ItemTooltip` and the tooltip component (useful on
    Classic too).
13. **Forever labels:** ruleset and flavour in the locker, character pages and
    add-character flow.
14. **Item comparison again** on Era's own table when wago.tools is back
    (`spike/forever-items/`), and on the launch build.

### If Battle.net serves Forever

15. **Adapter:** the namespace in `ns`, realms (rulesets, or none: the
    probe tells) for the add-character flow, the full name in the
    character path.
16. **Talents from the API:** a Mainline-shaped specializations answer
    (loadouts, selected nodes) read into the trait tree view.
17. **Stats from the API:** its statistics fields mapped onto the new
    `Stats` fields; whatever it lacks stays empty.
18. Ownership, the account's character list and renders as for Classic: no
    link codes.

### If it doesn't

19. **`/wl link CODE`:** keeps the code in the saved file (`link = { code, at
    }`), as Hearthtale's `/ht link`.
20. **Forever-only snapshot**, since no API provides it: class, race, gender,
    realm name; equipment (item link per slot, with its tooltip lines from
    `C_TooltipInfo.GetInventoryItem` and its icon file id); talents
    (`C_ClassTalents` active config, every node's rank and choice, plus the
    account trees); character stats (the character sheet's list above);
    average item level.
21. Ravenpost shows an "unlinked" Forever character's way to link it
    (`/wl link CODE`, code from wow-locker.app), as for Hearthtale.
22. **Link codes:** `POST /api/link-codes` for a signed-in account (as
    Hearthtale's `lib/link.ts`: one use, thirty minutes, in the ephemeral
    table); an upload carrying a code attaches its character to the account.
23. **Addon-only characters:** created and updated from linked uploads, keyed
    on the GUID; `refreshCharacter` and the tracker skip them (no API to
    call); private to the account unless shared. Forever characters can't
    be added by name: they come from the companion, linked by code.
24. **Payloads:** the addon's equipment with tooltips, talents (trait config)
    and stats, validated like every addon field (clamped, size-limited).
25. **Item tooltips and icons from uploads:** stored per item string;
    `itemTooltip` serves them for Forever instead of calling Battle.net;
    icon file ids mapped to names for the render CDN.
26. **Link a character:** the code panel (as Hearthtale's `LinkCharacter`,
    with its "Get a new code" button).

### At launch (4 November)

27. Install the live client: the game folder's name (Ravenpost label), the
    interface number (TOC), the rulesets, and a first session checking the
    simulation's assumptions in the real game (Hearthtale's first sessions
    each found a bug the tests couldn't).
28. One probe for a Forever namespace: it picks "If Battle.net serves
    Forever" or "If it doesn't".
29. The talents and items checked again on the launch build: the trait
    tables, and whether the items missing from the beta came back.

### Later

30. Bags, bank, mail, cooldowns, reputations, professions, pets on Forever.
31. Maps of the new zones (Riverglades, Mount Hyjal, Ruins of Gilneas,
    Shen'dralas, Zephras Isle) with `scripts/maps.py`.
32. The Hardcore ruleset, when it opens: alive or fallen, the memorial.
33. If the addon way was taken and a namespace comes later: the adapter,
    and the linked characters matched to the API's.
