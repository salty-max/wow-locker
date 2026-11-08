-- WoWLocker against a client that behaves like World of Warcraft: Forever
-- (interface 16xxx), strictly: no combat log (registering it throws), the
-- player's health secret, only the C_ APIs (no GetItemInfo, GetSpellInfo,
-- GetNumTalentTabs, GetQuestLogTitle, GetSkillLineInfo, GetFactionInfo),
-- a surname where other clients return a realm, trait-tree talents.
--   luajit addon/test/forever.lua      (from the repo root)
local T0 = 1793000000
local clock = T0
function time() return clock end
local function tick(s) clock = clock + s end

-- A secret value: opaque, it can't be compared, added or saved.
local SECRET = setmetatable({}, { __tostring = function() return "<secret>" end })
function issecretvalue(v) return v == SECRET end

local state = {
  level = 12, xp = 300, xpMax = 5000, rested = 0, money = 4321, dead = false,
  slots = { [5] = "|cffffffff|Hitem:57:0|h[Acolyte's Robe]|h|r", [10] = "|cff1eff00|Hitem:9999:0|h[Gold-flecked Gloves]|h|r" },
  target = { name = "Defias Pillager", hostile = true },
  quests = { { title = "Elwynn Forest", isHeader = true }, { title = "The Defias Brotherhood", questID = 155 } },
  ranks = { [101] = 2, [102] = 0, [201] = 1 }, -- trait node ranks
}

-- ── the strict client: frames refuse the combat log, like Forever ──
local frame
function CreateFrame()
  frame = { events = {} }
  function frame:RegisterEvent(e)
    if e == "COMBAT_LOG_EVENT_UNFILTERED" then error("Frame:RegisterEvent(): Attempt to register forbidden event", 2) end
    self.events[e] = true
  end
  function frame:RegisterUnitEvent(e, ...) self.events[e] = { ... } end
  function frame:SetScript(_, fn) self.handler = fn end
  return frame
end
local function fire(e, ...) assert(frame.events[e], "not registered: " .. e); frame.handler(frame, e, ...) end

LowHealthFrame = { shown = false }
function LowHealthFrame:Show() self.shown = true end
function LowHealthFrame:Hide() self.shown = false end
function LowHealthFrame:IsShown() return self.shown end
function hooksecurefunc(t, name, fn)
  local orig = t[name]
  t[name] = function(...) local r = orig(...); fn(...); return r end
end

function GetBuildInfo() return "1.60.1", "70862", "Nov 4 2026", 16001 end
function GetLocale() return "enUS" end
function UnitGUID() return "Player-6946-0008653C" end
-- surname in the realm's place
function UnitName(u)
  if u == "player" then return "Sealine", "Dion" end
  if u == "target" then return state.target and state.target.name, nil end
  if u == "pet" then return state.pet and state.pet.name, nil end
  return ({ party1 = "Oma" })[u], ({ party1 = "Dessala" })[u]
end
function GetRealmName() return "Classic Beta PvP" end
function UnitClass() return "Paladin", "PALADIN" end
function UnitRace() return "Dwarf", "Dwarf" end
function UnitFactionGroup() return "Alliance" end
function UnitLevel() return state.level end
function UnitXP() return state.xp end
function UnitXPMax() return state.xpMax end
function GetXPExhaustion() return state.rested end
function GetMoney() return state.money end
function GetGuildInfo() return nil end
function IsInGuild() return false end
function UnitHealth() return SECRET end
function UnitHealthMax() return SECRET end
function UnitIsDeadOrGhost(u) return u == "player" and state.dead end
function UnitIsDead(u) return u == "pet" and state.petDead or false end
function UnitExists(u) if u == "target" then return state.target ~= nil end; return u ~= "pet" or state.pet ~= nil end
function UnitCanAttack() return state.target and state.target.hostile end
function GetRealZoneText() return "Elwynn Forest" end
function GetSubZoneText() return "Goldshire" end
function IsInInstance() return false, "none" end
function GetInstanceInfo() return "x" end
function IsInRaid() return false end
function GetNumGroupMembers() return 2 end
function IsResting() return false end
function HasNewMail() return false end
function GetInboxNumItems() return 0 end
function RequestTimePlayed() end
function GetTime() return 7000 + (clock - T0) end
function GetInventoryItemLink(_, slot) return state.slots[slot] end
function GetInventoryItemID(_, slot) return state.slots[slot] and tonumber(state.slots[slot]:match("|Hitem:(%d+)")) end
function GetInventoryItemTexture(_, slot) return state.slots[slot] and 132000 + slot or nil end
function GetAverageItemLevel() return 14.4 end
C_Map = { GetBestMapForUnit = function() return 37 end, GetPlayerMapPosition = function() return { x = 0.42, y = 0.65 } end }
C_GameRules = { IsHardcoreActive = function() return false end }
C_Timer = { After = function(_, fn) fn() end }
NUM_CHAT_WINDOWS = 1
ChatFrame1 = { UnregisterEvent = function() end, RegisterEvent = function() end }
SlashCmdList = {}

-- the C_ APIs only
C_Item = {
  GetItemInfo = function(id) return id == 15846 and "Salt Shaker" or nil end,
  GetItemCount = function() return 0 end,
}
C_Spell = { GetSpellName = function(id) return id == 18560 and "Mooncloth" or nil end, GetSpellCooldown = function() return { startTime = 0, duration = 0 } end }
C_Container = {
  GetContainerNumSlots = function() return 0 end,
  GetItemCooldown = function() return 0, 0, 1 end,
  ContainerIDToInventoryID = function(bag) return 19 + bag end,
}
C_QuestLog = {
  GetNumQuestLogEntries = function() return #state.quests end,
  GetInfo = function(i) return state.quests[i] end,
  GetAllCompletedQuestIDs = function() return { 7, 33 } end,
  GetTitleForQuestID = function(id) return id == 155 and "The Defias Brotherhood" or nil end,
}
function IsPlayerSpell() return false end
function GetProfessions() return 1, nil, 3 end
function GetProfessionInfo(i) return ({ "Mining", "x", "Cooking" })[i], "icon", 31, 75 end
C_Reputation = {
  GetNumFactions = function() return 2 end,
  GetFactionDataByIndex = function(i)
    if i == 1 then return { name = "Alliance", isHeader = true, isHeaderWithRep = false } end
    return { name = "Stormwind", reaction = 5, currentReactionThreshold = 3000, nextReactionThreshold = 9000, currentStanding = 3600 }
  end,
}
function UnitPowerType() return 0, "MANA" end
function UnitPowerMax() return 640 end
function UnitStat(_, i) return 20 + i, 25 + i end
function UnitArmor() return 300, 410 end
function UnitAttackPower() return 100, 20, -5 end
function UnitRangedAttackPower() return 50, 0, 0 end
function GetSpellBonusDamage() return 33 end
function GetSpellBonusHealing() return 41 end
function GetCritChance() return 5.25 end
function GetRangedCritChance() return 4.5 end
function GetSpellCritChance() return 6.04 end
CR_HIT_MELEE, CR_HIT_RANGED, CR_HIT_SPELL, CR_DEFENSE_SKILL = 1, 2, 3, 4
function GetCombatRatingBonus(cr) return cr == 1 and 1.5 or 0 end
function GetHitModifier() return 1 end
function GetSpellHitModifier() return 0 end
function GetHaste() return 2 end
function GetExpertise() return 1 end
function GetArmorPenetration() return 0 end
function GetSpellPenetration() return 0 end
function GetDodgeChance() return 4.7 end
function GetParryChance() return 5 end
function GetBlockChance() return 8 end
function GetUnitSpeed() return 0, 7, 7, 4.7 end
C_TooltipInfo = {
  GetInventoryItem = function(_, slot)
    if slot ~= 5 then return nil end
    return { lines = {
      { leftText = "Acolyte's Robe" }, { leftText = "Chest", rightText = "Cloth" }, { leftText = "+4 Spirit" },
      { leftText = "Equip: Improves spell power by 8." }, { leftText = SECRET },
    } }
  end,
}
C_ClassTalents = { GetActiveConfigID = function() return 77 end }
C_Traits = {
  GetConfigInfo = function() return { treeIDs = { 10, 11 } } end,
  GetTreeNodes = function(tree) return tree == 10 and { 101, 102 } or { 201 } end,
  GetNodeInfo = function(_, node) return { currentRank = state.ranks[node], activeEntry = { entryID = node * 10 } } end,
}
function GetNumStableSlots() return 0 end

local printed = {}
function print(...) printed[#printed + 1] = table.concat({ ... }, " ") end
date = os.date
local ns = {}
assert(loadfile("addon/WowLocker/WowLocker.lua"))("WowLocker", ns)

-- Classic's globals are gone here: using one would be an error.
assert(GetItemInfo == nil and GetSpellInfo == nil and GetNumTalentTabs == nil and GetQuestLogTitle == nil)
assert(GetSkillLineInfo == nil and GetFactionInfo == nil and CombatLogGetCurrentEventInfo == nil)

-- ── the session ──
fire("PLAYER_LOGIN")
fire("PLAYER_ENTERING_WORLD")
local me = WowLockerDB.characters["Player-6946-0008653C"]
local function check(cond, msg) assert(cond, msg); io.write("✓ " .. msg .. "\n") end
check(ns.forever == true, "the addon knows it is on Forever")
check(not frame.events.COMBAT_LOG_EVENT_UNFILTERED, "the combat log is never registered")
check(me.name == "Sealine Dion" and me.realm == "Classic Beta PvP", "name is first name and surname, the realm from GetRealmName")
check(me.class == "PALADIN" and me.race == "Dwarf", "an old race with a new class (dwarf paladin)")
check(#me.state.equipment == 2 and me.state.equipment[1].id == 57, "equipment read through the same links")
local robe = me.state.equipment[1]
check(robe.icon == 132005 and robe.link:find("Hitem:57", 1, true), "an item's icon file id and link are kept")
check(#robe.tip == 4 and robe.tip[2] == "Chest\tCloth" and robe.tip[4]:find("spell power"), "its tooltip lines, the hidden one left out")
check(me.state.stats.strength == 26 and me.state.stats.armor == 410 and me.state.stats.attackPower == 115, "stats: attributes, armor, attack power summed")
check(me.state.stats.spellCrit == 6 and me.state.stats.meleeHit == 2.5 and me.state.stats.dodge == 4.7 and me.state.stats.speed == 100, "stats: crit, hit with its modifier, dodge, speed")
check(me.state.stats.bonusHealing == 41 and me.state.stats.parry == 5 and me.state.stats.expertise == 1, "stats: bonus healing, parry, expertise")
check(me.state.itemLevel == 14, "average item level")
local tr = me.state.traits
check(tr and tr.config == 77 and #tr.trees == 2 and tr.trees[1].points == 2 and #tr.trees[1].nodes == 1, "traits: purchased nodes per tree")
check(tr.trees[1].nodes[1].node == 101 and tr.trees[1].nodes[1].entry == 1010 and tr.trees[1].nodes[1].rank == 2, "a node's id, chosen entry and rank")
check(#me.state.skills == 2 and me.state.skills[1].section == "Professions", "professions from the professions list")
check(#me.state.reputations == 1 and me.state.reputations[1].name == "Stormwind" and me.state.reputations[1].value == 600, "reputation from C_Reputation")
check(#me.state.questsCompleted == 2, "completed quests")

-- an item link with Forever's quality token
tick(5); state.slots[10] = "|cnIQ3:|Hitem:1234:0|h[Shiny Gloves]|h|r"; fire("PLAYER_EQUIPMENT_CHANGED", 10, true)
check(me.state.equipment[2].color == "0070dd" and me.events[#me.events].color == "0070dd", "a quality token in the link reads as its colour")

-- a quest accepted: title from the C_QuestLog
tick(30); fire("QUEST_ACCEPTED", 155)
-- a close call: the health is secret, the game's low-health warning is the signal
tick(30); fire("PLAYER_TARGET_CHANGED")
-- the same frame shows in a fight under a full-screen panel (the maximised map): not a close call
function GetUIPanel(which) return which == "fullscreen" and state.fullscreen or nil end
state.fullscreen = true; LowHealthFrame:Show(); LowHealthFrame:Hide(); state.fullscreen = nil
check(not (function() for _, e in ipairs(me.events) do if e.type == "close_call" then return true end end end)(), "no close call from the warning under a full-screen panel")
LowHealthFrame:Show()
fire("UNIT_HEALTH", "player") -- secret: ignored, no error
LowHealthFrame:Show() -- shown again while still low: the same close call
LowHealthFrame:Hide()
tick(60); LowHealthFrame:Show(); LowHealthFrame:Hide()
-- talents: a point spent in a tree
tick(10); state.ranks[102] = 1; fire("TRAIT_CONFIG_UPDATED")
-- no trees at first (no active config yet): the first loadout is a baseline, not a change
local configure = C_ClassTalents.GetActiveConfigID
C_ClassTalents.GetActiveConfigID = function() return nil end
fire("CHARACTER_POINTS_CHANGED")
C_ClassTalents.GetActiveConfigID = configure
fire("CHARACTER_POINTS_CHANGED")
-- a pet's death without the combat log
state.pet = { name = "Wolfy" }; ns.petGUID = "Pet-0-1"
me.state.pet = { name = "Wolfy", family = "Wolf", level = 11, active = true }
tick(5); state.petDead = true; fire("UNIT_HEALTH", "pet")
-- a death: the foe is the target we were fighting
tick(30); state.dead = true; fire("PLAYER_DEAD")
tick(5); fire("PLAYER_LOGOUT")

local count, byType = {}, {}
for _, e in ipairs(me.events) do count[e.type] = (count[e.type] or 0) + 1; byType[e.type] = byType[e.type] or e end
check(count.close_call == 2 and byType.close_call.warned == true and byType.close_call.pct == 35, "two close calls from the low-health warning, saved at its threshold")
check(byType.close_call.attacker == "Defias Pillager", "the close call names the foe from the target")
check(count.quest_accept == 1 and byType.quest_accept.title == "The Defias Brotherhood", "quest accepted with its title")
check(count.talent == 1 and me.state.traits.trees[1].points == 3, "a spent talent point is an event and updates the trees")
check(count.death == 1 and byType.death.killer == "Defias Pillager" and byType.death.level == 12, "a death names the target as the killer")
check(count.pet_death == 1 and byType.pet_death.name == "Wolfy", "a pet's death is read from its own health event")
for _, p in ipairs(printed) do assert(not p:find("failed"), "a handler failed: " .. p) end
check(true, "no handler failed on the strict client")
for _, e in ipairs(me.events) do
  local text = ns.formatEvent(e)
  assert(type(text) == "string" and text ~= "" and not text:find("nil"), "bad line for " .. e.type)
end
check(true, "every recorded event formats as a log line")
