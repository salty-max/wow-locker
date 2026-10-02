-- Runs WowLocker.lua against a minimal fake WoW API and replays a session.
--   luajit addon/test/sim.lua      (from the repo root)
local clock = 1790900000
function time() return clock end
local state = {
  level = 22, xp = 1542, xpMax = 27300, rested = 4000, money = 12345, guild = nil,
  talents = { { "Arcane", 0 }, { "Fire", 2 }, { "Frost", 10 } },
  slots = { [10] = "|cff1eff00|Hitem:9999:0|h[Gold-flecked Gloves]|h|r" },
}
local frame
function CreateFrame() frame = { events = {} }
  function frame:RegisterEvent(e) self.events[e] = true end
  function frame:SetScript(_, fn) self.handler = fn end
  return frame
end
local function fire(e, ...) assert(frame.events[e], "not registered: " .. e); frame.handler(frame, e, ...) end
function UnitGUID() return "Player-5233-03D9B7D8" end
function UnitName() return "Namzie" end
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
function GetNumTalentTabs() return #state.talents end
function GetTalentTabInfo(i) return state.talents[i][1], "icon", state.talents[i][2] end
function GetRealZoneText() return "Westfall" end
function GetSubZoneText() return "Moonbrook" end
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

fire("PLAYER_LOGIN")
fire("TIME_PLAYED_MSG", 86400, 3600)
clock = clock + 60
state.slots[10] = "|cff0070dd|Hitem:1234:0|h[Shiny Gloves]|h|r"; fire("PLAYER_EQUIPMENT_CHANGED", 10, true)
clock = clock + 60
state.slots[10] = "|cff1eff00|Hitem:9999:0|h[Gold-flecked Gloves]|h|r"; fire("PLAYER_EQUIPMENT_CHANGED", 10, true)
clock = clock + 600
state.level = 23; fire("PLAYER_LEVEL_UP", 23)
state.talents[3][2] = 11; fire("CHARACTER_POINTS_CHANGED")
state.talents = { { "Arcane", 0 }, { "Fire", 11 }, { "Frost", 0 } }; fire("CHARACTER_POINTS_CHANGED")
state.guild = "Dice"; fire("PLAYER_GUILD_UPDATE")
fire("PLAYER_GUILD_UPDATE") -- no change: no event
combat = { 0, "SWING_DAMAGE", false, "Creature-0", "Defias Pillager", 0, 0, "Player-5233-03D9B7D8", "Namzie", 0, 0, 120 }
fire("COMBAT_LOG_EVENT_UNFILTERED")
combat = { 0, "SPELL_DAMAGE", false, "Creature-0", "Defias Pillager", 0, 0, "Player-5233-03D9B7D8", "Namzie", 0, 0, 133, "Fireball" }
fire("COMBAT_LOG_EVENT_UNFILTERED")
clock = clock + 5
fire("PLAYER_DEAD")
state.money = 99999; fire("PLAYER_MONEY")
-- As in the real client: by PLAYER_LOGOUT, XP and money already read 0.
state.xp, state.xpMax, state.rested, state.money = 0, 0, nil, 0
fire("PLAYER_LOGOUT")

local me = WowLockerDB.characters["Player-5233-03D9B7D8"]
for _, e in ipairs(me.events) do
  local parts = {}
  for k, v in pairs(e) do
    if k ~= "t" and k ~= "type" and k ~= "trees" then parts[#parts + 1] = k .. "=" .. tostring(v) end
  end
  if e.trees then
    local tr = {}
    for _, t in ipairs(e.trees) do tr[#tr + 1] = t.name .. ":" .. t.points end
    parts[#parts + 1] = "trees=" .. table.concat(tr, "/")
  end
  table.sort(parts)
  print2 = print2 or io.write
  io.write(("+%4ds %-7s %s\n"):format(e.t - 1790900000, e.type, table.concat(parts, " ")))
end
local s = me.state
io.write(("state: level %d xp %d/%d rested %d money %d played %d/%d zone %s/%s at %s,%s guild %s hardcore %s\n"):format(
  s.level, s.xp, s.xpMax, s.rested, s.money, s.playedTotal, s.playedLevel, s.zone, s.subZone, s.x, s.y, tostring(s.guild), tostring(s.hardcore)))
io.write(("played requested %d times (login, level up, death)\n"):format(playedAsked))
assert(s.xpMax == 27300 and s.money == 99999 and s.rested == 4000, "logout must keep the last good XP / money / rested")
io.write("logout kept the last good XP, rested and money ✓\n")
