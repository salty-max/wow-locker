# WoWLocker on World of Warcraft: Forever

> **Plan for launch (4 November 2026), revised 7 October 2026.** Forever
> characters come from the addon, through Ravenpost; their owner is proved
> the way Hearthtale already does it on Forever: a link code typed in the
> game. Battle.net stays the source for Classic, and becomes one for Forever
> only if Blizzard opens a Forever namespace (one probe after launch, not a
> polling loop). The 5 October plan waited for that namespace; it set the
> addon-first port aside because an addon-only character had no provable
> owner. Hearthtale's link codes solve that, and its first real Forever
> sessions (7 October) showed what the client does differently: both below.

Forever (beta since 17 September 2026, launch 4 November 2026) is the original
Azeroth on the modern Mainline client, with reworked talents and items.

## What Forever changes for us

Checked 5 October (client data, API probes), and 7 October in the real
client with Hearthtale (Forever beta, realm "Classic Beta PvP").

- **No Battle.net API.** `spike/FINDINGS.md` (1 October): no Forever
  namespace, every guess answers like a nonsense one. Nothing announced.
  Everything the API gives us today (summary, equipment, talents, stats,
  render, the account's character list) is missing for Forever.
- **Names: a first name and a surname.** `UnitName(unit)` returns the
  surname as its second value, where other clients return the realm
  ("Hellefie", "Namzan"); `GetUnitName("player")` gives "Hellefie Namzan",
  the realm comes from `GetRealmName()`. A full name is unique per realm
  type, a first name isn't: two "Hellefie"s can share a realm. Reading
  `name, realm = UnitName("player")` saves the surname as the realm
  (AllTheThings issue #2630 made that mistake).
- **Talents are trait trees.** Forever's client data (wago.tools
  `wow_classic_beta`, build 1.60.1.70205) keeps the 27 classic TalentTabs, but
  its talents are 17 Mainline-style trait trees (TraitTree, TraitNode,
  TraitNodeEntry, TraitDefinition, TraitCond, TraitEdge): positioned nodes,
  edges, ranks, choice nodes, with later-era abilities (Riptide, Lava Burst,
  Wild Growth, Mutilate, Bane of Havoc). Three of them are account-wide perk
  trees (Thrill of Adventure, Bartering, Master Chef…). The addon reads them
  with `C_ClassTalents` / `C_Traits`.
- **Items are re-statted.** 3,420 of the 14,261 item ids shared with Classic
  Era have different stats, 4,963 are new. Stats use Mainline budgets
  (StatPercentEditor, ratings such as hit and crit), not fixed values, so a
  static table would mean reproducing Blizzard's formula. The client's
  tooltip is exact.
- **Addon API (Midnight rules):** no combat log for addons (registering it
  throws: Hearthtale counts kills from the corpses of what it fought);
  secret values (health, auras, some unit data) in boss encounters and
  Mythic+; Classic globals gone: `GetItemInfo` (confirmed: a Lua error in
  Hearthtale 0.5.0), `GetSpellInfo`, `GetNumTalentTabs`/`GetTalentInfo`,
  `GetNumSkillLines`/`GetSkillLineInfo`, likely
  `GetQuestLogTitle`/`GetNumQuestLogEntries`, `GetFactionInfo`,
  `GetStablePetInfo`, `GetItemCooldown`.
- **Items not loaded yet** (confirmed): `C_Item.GetItemInfo` returns nothing
  for an item the client hasn't loaded, so its quality comes from the link's
  colour (`|cff1eff00`, or `|cnIQ2:`). A quest objective for such an item
  comes without its name ("0/8 ") until the item is loaded.
- **Game strings with numbered blanks** (confirmed): `QUEST_OBJECTS_FOUND` is
  like `"%2$d/%3$d %1$s"` ("0/8 Tough Wolf Meat"): patterns built from it
  must keep each blank's argument number.
- **At login the zone may not be known yet** (confirmed): `GetRealZoneText`
  is empty for a few seconds; what is recorded "at login" must wait for it.
- **Game folder:** `_classic_beta_` during the beta (Ravenpost labels it
  "World of Warcraft: Forever (beta)"); the live folder's name is only known
  at launch. Under `WTF/Account/<account>/` the realm folder is a number
  ("70"), the character folders are "First-Surname" ("Hellefie-Namzan").
  The game keeps a deleted character's folder.

## Decisions

| Question | Decision |
|---|---|
| Data source | **The addon, at launch.** Battle.net if a Forever namespace ever opens (an adapter beside the addon source). |
| Ownership | **A link code, as Hearthtale.** Signed in on wow-locker.app, the player gets a six-letter code (one use, thirty minutes) and types `/wl link CODE` in the game; the addon keeps it in its saved file, and the upload that carries it attaches the character to that account. Without a code, a Forever character uploads as "unlinked", and Ravenpost says how to link it. |
| Character identity | The GUID (realm id + character id), as today; shown with its full name, the realm from `GetRealmName()`. |
| Talents | **Full trait trees**, drawn from Forever's client data, filled from the addon's talent snapshot. |
| Item stats | **Tooltips from the addon**: each equipped (and bag) item's tooltip lines, read in game, uploaded, cached per item string. |
| First release | **Core first:** character, level, gear with tooltips, talents, stats, deaths, quests, sessions. Bags, bank, mail, cooldowns, reputations, professions, pets and the new zones' maps follow. |
| Deleted characters | Ravenpost hides what the site calls "gone". For Forever there is no Battle.net list: a full name played again on the same realm makes the older character gone, as for Classic since 7 October. |

## Work for launch

### Addon (`addon/WowLocker`)

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
4. **Secret values:** checked before use (`UnitHealth` for close calls:
   skipped while secret).
5. **Modern APIs:** `C_Item.GetItemInfo` (nil until loaded: quality from the
   link's colour; names read again until loaded), `C_Spell.GetSpellInfo`,
   `C_QuestLog` (numbered blanks; names possibly missing at first),
   `C_Reputation`, professions, `C_Container`.
6. **`/wl link CODE`:** keeps the code in the saved file (`link = { code, at
   }`), as Hearthtale's `/ht link`.
7. **Forever-only snapshot**, since no API provides it: class, race, gender,
   realm name; equipment (item link per slot, with its tooltip lines from
   `C_TooltipInfo.GetInventoryItem`); talents (`C_ClassTalents` active
   config, every node's rank and choice, plus the account trees); character
   stats (primary stats, armor, attack power, crit, hit, spell power…).
8. **Simulation:** a test client that behaves like today's: no combat log,
   secret values, only the C_ APIs, items not loaded until asked for,
   numbered game strings, surnames, no zone at login (Hearthtale's
   `addon/test/game.lua` does all of it already).

### Ravenpost

9. Label Forever's live folder once its name is known at launch (the beta's
   `_classic_beta_` is done).
10. Show an "unlinked" Forever character's way to link it (`/wl link CODE`,
    code from wow-locker.app), as for Hearthtale.

### API (`apps/api`)

11. **Flavour `forever`** in `@wow-locker/shared` (no Battle.net namespace).
12. **Link codes:** `POST /api/link-codes` for a signed-in account (as
    Hearthtale's `lib/link.ts`: one use, thirty minutes, in the ephemeral
    table); an upload carrying a code attaches its character to the account.
13. **Addon-only characters:** created and updated from linked uploads, keyed
    on the GUID; `refreshCharacter` and the tracker skip them (no API to
    call); private to the account unless shared.
14. **Payloads:** the addon's equipment with tooltips, talents (trait config)
    and stats, validated like every addon field (clamped, size-limited).
15. **Item tooltips:** stored per item string from uploads; `itemTooltip`
    serves them for Forever instead of calling Battle.net.

### Site (`apps/web`)

16. **Link a character:** the code panel (as Hearthtale's `LinkCharacter`,
    with its "Get a new code" button).
17. **Trait tree data:** `scripts/talents.ts` extended for Forever (wago.tools,
    pinned build): trees, nodes with positions, edges, entries, ranks, choice
    nodes, icons (SpellMisc + ManifestInterfaceData). Committed as
    `src/data/talents/forever.json`; checked again against the launch build.
18. **Trait tree view:** nodes placed by PosX/PosY, edges, ranks, choices, the
    account perk trees apart.
19. **Gear and stats from the addon** for Forever characters, tooltips from
    the uploaded lines.
20. **Forever labels:** realm and flavour in the locker, character pages and
    add-character flow (Forever characters can't be added by name: they come
    from the companion, linked by code).

### At launch (4 November)

21. Install the live client: the game folder's name (Ravenpost label), the
    interface number (TOC), the realm names, and a first session checking
    the simulation's assumptions in the real game (Hearthtale's first
    sessions each found a bug the tests couldn't).
22. One probe for a Forever namespace. If it exists: an API adapter, and
    ownership proved by the account endpoint as for Classic.

### Later

23. Bags, bank, mail, cooldowns, reputations, professions, pets on Forever.
24. Maps of the new zones (Riverglades, Mount Hyjal, Ruins of Gilneas,
    Shen'dralas, Zephras Isle) with `scripts/maps.py`.
