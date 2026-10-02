-- Runs WowLocker.lua against a minimal fake WoW API and replays a session.
--   luajit addon/test/sim.lua      (from the repo root)
local T0 = 1790900000
local clock = T0
function time() return clock end
local state = {
  level = 22, xp = 1542, xpMax = 27300, rested = 4000, money = 12345, guild = nil,
  hp = 380, hpMax = 380, dead = false,
  talents = { { "Arcane", 0 }, { "Fire", 2 }, { "Frost", 10 } },
  slots = { [10] = "|cff1eff00|Hitem:9999:0|h[Gold-flecked Gloves]|h|r" },
  questLog = { { "Elwynn Forest", true }, { "The Defias Brotherhood", false, 155 } },
  completed = { [7] = true, [33] = true },
  skills = { { "Professions", true }, { "Cooking", false, 24, 75 }, { "Weapon Skills", true }, { "Staves", false, 98, 110 } },
  factions = { { "Alliance", true }, { "Stormwind", false, 4, 0, 3000, 2950 } },
  instance = { false, "none" },
}
local frame
function CreateFrame()
  frame = { events = {} }
  function frame:RegisterEvent(e) self.events[e] = true end
  function frame:RegisterUnitEvent(e) self.events[e] = true end
  function frame:SetScript(_, fn) self.handler = fn end
  return frame
end
local function fire(e, ...) assert(frame.events[e], "not registered: " .. e); frame.handler(frame, e, ...) end
local function tick(s) clock = clock + s end

function UnitGUID() return "Player-6113-03D658B8" end
function UnitName(u) if u == "player" then return "Namzie" end; return ({ party1 = "Namzan", party2 = "Thorgrim" })[u] end
function GetRealmName() return "Soulseeker" end
function UnitClass() return "Mage", "MAGE" end
function UnitRace() return "Gnome", "Gnome" end
function UnitFactionGroup() return "Alliance" end
function UnitLevel() return state.level end
function UnitXP() return state.xp end
function UnitXPMax() return state.xpMax end
function GetXPExhaustion() return state.rested end
function GetMoney() return state.money end
function GetGuildInfo() return state.guild end
function IsInGuild() return state.guild ~= nil end
function UnitHealth() return state.hp end
function UnitHealthMax() return state.hpMax end
function UnitIsDeadOrGhost() return state.dead end
function GetNumTalentTabs() return #state.talents end
function GetTalentTabInfo(i) return state.talents[i][1], "icon", state.talents[i][2] end
function GetRealZoneText() return state.instance[1] and "The Deadmines" or "Westfall" end
function GetSubZoneText() return "Moonbrook" end
function IsInInstance() return state.instance[1], state.instance[2] end
function GetInstanceInfo() return "The Deadmines", "party" end
function IsInRaid() return false end
function GetNumGroupMembers() return 3 end
function GetNumQuestLogEntries() return #state.questLog end
function GetQuestLogTitle(i) local q = state.questLog[i]; return q[1], 18, 0, q[2], false, false, 0, q[3] end
function GetQuestsCompleted() return state.completed end
function GetNumSkillLines() return #state.skills end
function GetSkillLineInfo(i) local s = state.skills[i]; return s[1], s[2], true, s[3], 0, 0, s[4] end
function GetNumFactions() return #state.factions end
function GetFactionInfo(i) local r = state.factions[i]; return r[1], "", r[3], r[4], r[5], r[6], false, false, r[2], false, false end
FACTION_STANDING_LABEL5 = "Friendly"
LOOT_ITEM_SELF = "You receive loot: %s."
LOOT_ITEM_SELF_MULTIPLE = "You receive loot: %sx%d."
LOOT_ITEM_PUSHED_SELF = "You receive item: %s."
LOOT_ITEM_CREATED_SELF = "You create: %s."
C_Map = { GetBestMapForUnit = function() return 1436 end, GetPlayerMapPosition = function() return { x = 0.4213, y = 0.7461 } end }
C_GameRules = { IsHardcoreActive = function() return true end }
C_Timer = { After = function(_, fn) fn() end }
NUM_CHAT_WINDOWS = 1
ChatFrame1 = { UnregisterEvent = function() end, RegisterEvent = function() end }
local playedAsked = 0
function RequestTimePlayed() playedAsked = playedAsked + 1 end
function GetInventoryItemLink(_, slot) return state.slots[slot] end
local combat
function CombatLogGetCurrentEventInfo() return unpack(combat) end
SlashCmdList = {}
function print() end

dofile("addon/WowLocker/WowLocker.lua")

-- ── the session ──
fire("PLAYER_LOGIN")
fire("PLAYER_ENTERING_WORLD")
fire("TIME_PLAYED_MSG", 86400, 3600)
tick(60); state.slots[10] = "|cff0070dd|Hitem:1234:0|h[Shiny Gloves]|h|r"; fire("PLAYER_EQUIPMENT_CHANGED", 10, true)
tick(2); state.slots[10] = "|cff1eff00|Hitem:9999:0|h[Gold-flecked Gloves]|h|r"; fire("PLAYER_EQUIPMENT_CHANGED", 10, true)
tick(60); fire("CHAT_MSG_LOOT", "You receive loot: |cff9d9d9d|Hitem:1:0|h[Torn Claw]|h|r.") -- grey: ignored
fire("CHAT_MSG_LOOT", "You receive loot: |cff1eff00|Hitem:2:0|h[Defias Mask]|h|rx2.")
fire("CHAT_MSG_LOOT", "Thorgrim receives loot: |cffa335ee|Hitem:3:0|h[Epic Thing]|h|r.") -- someone else: ignored
-- Hardcore close call: 300 → 40 (11%) → 25 (7%) → back to 300; then another dip.
combat = { 0, "SWING_DAMAGE", false, "Creature-0", "Defias Pillager", 0, 0, "Player-6113-03D658B8", "Namzie", 0, 0, 120 }
fire("COMBAT_LOG_EVENT_UNFILTERED")
state.hp = 40; fire("UNIT_HEALTH", "player")
state.hp = 25; fire("UNIT_HEALTH", "player")
state.hp = 300; fire("UNIT_HEALTH", "player")
tick(30); state.hp = 50; fire("UNIT_HEALTH", "player")
state.hp = 380; fire("UNIT_HEALTH", "player")
-- quest turned in (title remembered from the log), XP + gold
tick(120); fire("QUEST_LOG_UPDATE"); fire("QUEST_TURNED_IN", 155, 1650, 3500)
-- level up: /played answer stamps the level event
tick(10); state.level = 23; fire("PLAYER_LEVEL_UP", 23); fire("TIME_PLAYED_MSG", 90000, 0)
-- skill milestone (24 → 26 crosses 25) + new skill; weapon skill +1 is not a milestone
state.skills[2][3] = 26; state.skills[4][3] = 99; table.insert(state.skills, { "First Aid", false, 1, 75 }); fire("SKILL_LINES_CHANGED")
-- reputation: Neutral(4) → Friendly(5)
state.factions[2][3] = 5; fire("UPDATE_FACTION")
-- dungeon: enter with a group, a /reload inside, die inside, leave
tick(300); state.instance = { true, "party" }; fire("PLAYER_ENTERING_WORLD")
tick(5); fire("PLAYER_ENTERING_WORLD") -- /reload: same run continues
tick(600); combat = { 0, "SPELL_DAMAGE", false, "Creature-0", "Edwin VanCleef", 0, 0, "Player-6113-03D658B8", "Namzie", 0, 0, 133, "Thrash" }
fire("COMBAT_LOG_EVENT_UNFILTERED"); state.hp = 30; fire("UNIT_HEALTH", "player")
tick(3); state.dead = true; fire("PLAYER_DEAD")
tick(1200); state.instance = { false, "none" }; fire("ZONE_CHANGED_NEW_AREA")
-- logout: the client has already cleared XP / money
state.xp, state.xpMax, state.rested, state.money = 0, 0, nil, 0
fire("PLAYER_LOGOUT")

-- ── report ──
local me = WowLockerDB.characters["Player-6113-03D658B8"]
local function fmt(v)
  if type(v) ~= "table" then return tostring(v) end
  local out = {}
  for _, x in ipairs(v) do out[#out + 1] = type(x) == "table" and (x.name .. ":" .. x.points) or tostring(x) end
  return table.concat(out, "/")
end
for _, e in ipairs(me.events) do
  local parts = {}
  for k, v in pairs(e) do if k ~= "t" and k ~= "type" then parts[#parts + 1] = k .. "=" .. fmt(v) end end
  table.sort(parts)
  io.write(("+%5ds %-13s %s\n"):format(e.t - T0, e.type, table.concat(parts, " ")))
end
local s = me.state
io.write(("state: level %d xp %d/%d rested %d money %d quests %d levelPlayed[23]=%s skills %d reps %d run=%s\n"):format(
  s.level, s.xp, s.xpMax, s.rested, s.money, #s.questsCompleted, tostring(s.levelPlayed[23]), #s.skills, #s.reputations, tostring(s.run)))

-- ── assertions ──
local count = {}
for _, e in ipairs(me.events) do count[e.type] = (count[e.type] or 0) + 1 end
local function check(cond, msg) assert(cond, msg); io.write("✓ " .. msg .. "\n") end
check(s.xpMax == 27300 and s.money == 12345, "logout kept the last good XP and money")
check(count.gear == 2, "both glove swaps recorded")
check(count.loot == 1, "only your own green-or-better loot")
check(count.close_call == 3, "three close calls (a recovery separates them)")
check(count.quest == 1 and me.events[#me.events].type == "logout", "quest turn-in recorded")
check(count.skill == 2, "skill milestone + new skill, not every weapon point")
check(count.reputation == 1, "reputation: Friendly with Stormwind")
check(count.dungeon_enter == 1 and count.dungeon_leave == 1, "one dungeon run despite the /reload")
check(#s.questsCompleted == 3, "completed quests: 2 known + the one turned in")
