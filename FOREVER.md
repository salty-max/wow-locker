# WoWLocker on World of Warcraft: Forever

> **Not started, held 20 Oct 2026.** This is the plan for when WoWLocker resumes.
> `spike/forever-items/` is gone from the tree (git history, commit 04fe33f).

> **Revised 5 November 2026, the day after launch: Battle.net serves Forever's account
> list.** The namespace `profile-forever-eu` exists and lists the account's
> Forever characters, so ownership can come from the API like Classic's, with
> no link code. The character endpoints (summary, equipment, talents, stats)
> are **not** served yet: every path 404s. So: ownership and the roster from
> the API now, the character's content from the addon through Ravenpost until
> Blizzard opens the rest. The facts are in "Battle.net the day after launch" below,
> the order of work in "Plan after the 5 November probe". The older plan (two
> ways in, decided by one probe) stays under "Work for launch" for the addon
> half, which it still serves in full.

Forever (beta since 17 September 2026, launch 4 November 2026) is the original
Azeroth on the modern Mainline client, with reworked talents and items.

## What Forever changes for us

Checked 5 October (client data, API probes), 7 October in the real client
with Hearthtale (Forever beta, realm "Classic Beta PvP"), and 13 October
(Forever's UI source, Gethe/wow-ui-source branch `forever`; Wowhead; the
client tables).

- **Battle.net: the account list only, from the day after launch** (5 November):
  see "Battle.net the day after launch". (Before launch there was none: no
  namespace in `spike/FINDINGS.md` of 1 October, nothing announced.)
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

## Battle.net the day after launch (probed 5 November 2026)

Signed in as the user (`wow.profile openid`, authorization code, EU), token
in memory only. Raw answers: the dispatcher's scratchpad, not kept.

| Call | Answer |
|---|---|
| `GET /profile/user/wow?namespace=profile-forever-eu` | **200**: the account (its id is the same as Classic's list gives) and its Forever characters. `profile-forever-us` answers 404 (nothing played there). |
| `GET /profile/user/wow/collections/mounts` (same namespace) | **200**: the account-wide mounts (two on this account). Account-level calls work. |
| `GET /profile/wow/character/<slug>` and every variant tried (`sealine-dion`, `sealine/dion`, `dion/sealine`, `6946/sealine-dion`, `6946-550204`, `550204`, capitalised, spaced, header namespace) | **404** (the header namespace form: 403). |
| `GET /profile/user/wow/protected-character/6946-550204` (the list's own link) and its sub-paths | **404**. |
| `dynamic-forever-eu`: `/data/wow/realm/6946`, realm index, connected-realm index | **404**. `/data/wow/search/realm` answers 200 with no results. |
| `static-forever-eu` | **200**: playable classes (nine, no Death Knight) and races (ten: Human, Orc, Dwarf, Night Elf, Undead, Tauren, Gnome, Troll and **High Order Skyborne 95, Windshaper Skyborne 96**). The key in links is the build, `static-1.60.1_70399-forever-eu`. |
| A nonsense namespace | 403, so the 404s above are real "not served yet", not "no such namespace". |

What a listed character carries (Sealine, Oma, Jeanne, all level 1):

```
{ character:{href}, protected_character:{href}, name:"Sealine", surname:"Dion",
  id:550204, playable_class:{id,name}, playable_race:{id,name},
  gender:{type}, faction:{type}, level:1 }
```

- **No realm object.** The pseudo-realm is only inside the links: the
  protected-character link is `.../protected-character/6946-550204`, i.e.
  `<realm id>-<character id>`, and the same list on Classic gives
  `5236-2393234`, `6113-88269365` (Soulseeker is 6113, which is also the GUID's
  realm part: Namzie's GUID is `Player-6113-03D658B8`, 0x03D658B8 = 64379064).
  The three Forever characters all show 6946: one id for these three, and
  whether it is per region or per ruleset is not known. A second account would
  tell.
- **The character link is `character/<name>-<surname>`** (lowercase), not
  `<realm>/<name>`. It 404s today, with or without the namespace, so the path
  is *shaped* but not *served*.
- **Hardcore and rulesets:** no field says. The list has no ruleset, no
  `is_hardcore`, no `is_self_found`. The three characters share realm 6946,
  but their rulesets are not recorded here, so whether a ruleset is in the id
  is not known. The
  Classic summary does carry `is_ghost` and `is_self_found`; whether
  Forever's summary will is unknown until it is served. Alive-or-fallen and
  Hardcore stay the addon's to say.
- **What is NOT known and could not be probed:** (a) that the in-game GUID of
  a Forever character is `Player-6946-<hex 550204>` (= `Player-6946-0008653C`):
  there is no Forever install on the probing computer, and no Forever GUID in
  the repositories. It is the obvious reading of the link and it held on
  Classic, but until one real GUID is compared it is a **guess**. (b) Whether
  a fallen or deleted character leaves the list (on Classic, deleted ones
  go). (c) Whether other account endpoints (pets, toys, transmogs, heirlooms)
  answer. (d) US and KR/TW lists, not played.

### The key that proves ownership

| Key | Verdict |
|---|---|
| **GUID realm + hex id** (`Player-6946-0008653C` against the link `6946-550204`) | The one to use, **once a real GUID confirms it**. Same shape as Classic, unique, no name handling. |
| The API's character `id` alone | Enough inside one game, but a Forever id and a Classic id are different numbers from one counter we can't see: `owned` must carry the realm id (or the game) next to it, never ids alone. |
| Full name `Name Surname` (list: `name` + `surname`) | A fallback only: the game says `Name Surname`, the API `name` and `surname` apart, and a renamed or transferred character drifts. Unique per region (Blizzard's names article), so no ambiguity inside a region. |

## Progress (8 November 2026)

Probed again on 8 November: the list now holds four characters, the
character endpoints still 404 (`protected-character/<id>/profile-summary`
answers 403), the account collections (mounts, pets, toys, heirlooms,
transmogs) and `static-forever-eu` items and talent-tree index answer 200.
The GUID match is confirmed by Hearthtale. Done in the API: the `forever`
flavour, the roster from the passport's Forever entry, ownership by id and
the GUID's realm, refresh skipped for Forever (items 2 and 3 below).

## Plan after the 5 November probe

The principle: **the API proves who owns a character, the addon says
everything else.** Nothing here waits for Blizzard.

1. **Confirm the GUID (the one unknown that decides the rest).** A Forever
   character logs in with the Hearthtale or WoWLocker addon on, the saved
   file's `Player-…` guid is compared with the list's `6946-<id>`. One
   character is enough; three (the user's) settles it. Do this before
   writing any matching code. If the GUID's number is not the id, the
   fallback is the full name (below) and everything else stays.
2. **Ravenpost's inbox: list Forever too** (`inbox/src/auth.ts` `account()`).
   Today it asks `profile-classic1x-<region>` only. Add `profile-forever-<region>`
   and put the result in the passport as a separate entry: `owned` gets a
   `game` (`"classic1x" | "forever"`) next to `region`, `ids` stay character
   ids, and for Forever each entry also carries `[id, realm id, "Name Surname"]`
   in `characters`. Old passports (no `game`) mean `classic1x`, so Hearthtale
   and WoWLocker keep working until they are updated. The passport's size
   limit (20,000 characters, 100 detailed) already covers it.
3. **WoWLocker: the account's Forever roster.** `accountProfile()` takes the
   `forever` flavour (`FLAVOURS` in `@wow-locker/shared` stays `classic1x` for the
   character endpoints). A signed-in account sees its Forever characters as
   *owned*, listed from the API (name, surname, class, race, gender, faction,
   level) and filled in by the addon's uploads as they arrive, keyed on the
   GUID. `refreshCharacter` and the tracker **skip Forever** until the
   summary answers (no API call to make); the add-by-name flow does not offer
   Forever. The class/race/gender/level from the list refresh the roster
   daily without the addon, which is more than the link-code plan gave.
4. **Link codes stay as the fallback, not the way in.** Built only when step 1
   says the GUID can't be matched, or for what the API can't list: a
   character the account lost (deleted, transferred), another region's, or a
   player who hasn't signed in with Battle.net through Ravenpost. They keep
   the shape in "If it doesn't" below (items 19 to 26), and are the last item
   of the work, not the first.
5. **Wait for the character endpoints, probe weekly.** One cheap probe
   (`character/<name>-<surname>` and the protected link, for any listed
   character), run by hand or by the Watchtower's preflight. When it turns
   200: the adapter of items 15 to 18 below comes back as planned (the slug
   is `name-surname`, no realm), with the addon's snapshot (items 20, 24) as
   the fallback for what it still lacks. Until then equipment, talents and
   stats come from the addon only.
6. **Hardcore:** from the addon (a Hardcore character is told in the game),
   stored on the character row, shown on the site. The API's summary may add
   `is_ghost` / a ruleset later; check it when it is served.
7. **Static data:** `static-forever-eu` answers, so classes, races (Skyborne
   95/96 included) and the item API for tooltips can be called with client
   credentials today. The equipment endpoint is not needed to start item
   tooltips: the static item API in `static-<build>-forever-eu`. Not probed
   for items in this pass (the user's note says it serves items): probe it
   when item tooltips are built.

Order of writing: 1 (a probe by hand) → 2 (inbox + passport, backward
compatible) → Hearthtale's side (below) → 3 → the addon's port (the "Both
ways" list, unchanged) → 5 whenever → 4 only if 1 failed.

### Hearthtale

- `lib/ravenpost.ts` `signInWithPassport`: read the passport's `game`; an
  entry without it is Classic (as now). For `forever`, call `loginAccount`
  with `region`, the character ids and the realm id.
- `accounts.owned` gets the game: `{ game, region, ids }`, `owns()` and
  `sexOf()` take it, and the match against an uploaded GUID compares the
  GUID's realm part too (`lib/guid.ts` already parses it). A migration
  fills `game = "classic1x"` on the stored entries.
- `lib/bnet.ts`: `FLAVOURS` gains `forever` only for the account list
  (`accountProfile`), not for the characters Hearthtale refreshes (it has none
  to refresh: its content comes from the addon). The Battle.net sign-in on
  the site (`authorizeUrl`, `exchangeCode`) already has the scope it needs.
- Link codes (`lib/link.ts`, `/ht link CODE`) stay as built and used for what
  the API can't list; the "link your character" panel stays but is hidden for
  an owned Forever character, and shown for the rest.
- Order: after the inbox's change (it can't match what the passport doesn't
  carry), and only after step 1 confirmed the GUID.

### Ravenpost

- **inbox:** the `forever` query in `auth.ts` `account()`, the `game` on
  `Owned` in `passport.ts`, tests next to `auth.test.ts` (a Forever list
  fixture from the shape above, a Classic-only passport unchanged). Deploys
  by hand with the user's go.
- **app:** nothing changes in the sign-in itself (`login.go` only carries
  the passport on). It labels Forever's characters as owned when the site
  says so, and drops the "unlinked, type /wl link or /ht link" hint for them.
- `site/src/components/Sends.astro` and the README: say that the sign-in now
  also asks Battle.net which Forever characters the account has (names only,
  nothing else).
- **If the GUID doesn't match:** the passport carries `[id, "Name Surname"]`
  and the site matches an uploaded character by full name within the region;
  anything that doesn't match stays "unlinked" and takes a link code.

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

The scripts were in `spike/forever-items/` (removed 30 Oct 2026, the scripts are at commit 04fe33f).

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
| Data source | **Both, split by what each can do (5 Nov).** Battle.net for the account's character list and so for ownership (`profile-forever-<region>`, served). The addon for everything about the character (gear, talents, stats, deaths, bags) until Blizzard serves the character endpoints, which 404 at launch. The adapter of items 15 to 18 comes back when they answer. |
| Ownership | **From the API: the account's Forever list, matched by GUID (realm 6946 + character id), once a real GUID confirms it.** **Fallback: a link code, as Hearthtale** (the rest of this row is that fallback). Signed in on wow-locker.app, the player gets a six-letter code (one use, thirty minutes) and types `/wl link CODE` in the game; the addon keeps it in its saved file, and the upload that carries it attaches the character to that account. Without a code, a Forever character uploads as "unlinked", and Ravenpost says how to link it. |
| Character identity | The GUID (realm id + character id), as today; shown with its full name, the realm from `GetRealmName()`. The GUID's match with the API's `<realm id>-<character id>` is checked against a real Forever GUID first (it held for Classic, 2 October; unverified on Forever, 5 November). |
| Talents | **Full trait trees**, drawn from Forever's client data, filled from the API's loadout or the addon's talent snapshot. Since items come partly through hotfixes, talents may too: the addon's snapshot (node ids, entries) is checked against the tree data, and an unknown node is reported, not dropped. |
| Item stats | **Tooltips from the API or the game** (see "Items"), never from client tables. |
| First release | **Core first:** character, level, gear with tooltips and sets, talents, stats, deaths, quests, sessions. Bags, bank, mail, cooldowns, reputations, professions, pets and the new zones' maps follow. |
| Deleted characters | Ravenpost hides what the site calls "gone". Without the API there is no Battle.net list: a full name played again makes the older character gone, as for Classic since 7 October. |

## Work for launch

### Both ways

The addon (`addon/WowLocker`):

1. **Two packages, one source** (as Hearthtale and Lorekeeper's Codex):
   Classic TOC `11509`, Forever TOC `16001`; the code checks the game
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
    (scripts in git history, 04fe33f), and on the launch build.

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
28. ✅ One probe for a Forever namespace (5 November): the account list is
    served, the character endpoints are not: see "Battle.net the day after launch".
    "If Battle.net serves Forever" applies to the list now, to the rest when
    the endpoints answer.
29. The talents and items checked again on the launch build: the trait
    tables, and whether the items missing from the beta came back.

### Later

30. Bags, bank, mail, cooldowns, reputations, professions, pets on Forever.
31. Maps of the new zones (Riverglades, Mount Hyjal, Ruins of Gilneas,
    Shen'dralas, Zephras Isle) with `scripts/maps.py`.
32. The Hardcore ruleset, when it opens: alive or fallen, the memorial.
33. If the addon way was taken and a namespace comes later: the adapter,
    and the linked characters matched to the API's.
