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
function GetGuildInfo() if state.guildLoading then return nil end; return state.guild end
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
-- resting, mail, cooldowns
state.resting = false
function IsResting() return state.resting end
state.newMail = true
function HasNewMail() return state.newMail end
ATTACHMENTS_MAX_RECEIVE = 12
state.inbox = {
  { sender = "Namzan", subject = "Gear for you", money = 0, days = 2.5, items = { { "Linen Cloth", 2589, 20, 1 } }, canReply = true, returned = false },
  { sender = "Stormwind Auction House", subject = "Auction expired: Mageweave", money = 0, days = 1.25, items = { { "Mageweave Cloth", 4338, 5, 1 } }, canReply = false, returned = false },
}
function GetInboxNumItems() return #state.inbox end
function GetInboxHeaderInfo(i)
  local m = state.inbox[i]
  return "pkg", "stationery", m.sender, m.subject, m.money, 0, m.days, #m.items, false, m.returned, false, m.canReply
end
function GetInboxItem(i, a) local it = state.inbox[i].items[a]; if it then return it[1], it[2], "tex", it[3], it[4], true end end
local uptime = 5000 -- GetTime() is seconds since boot, not a real clock
function GetTime() return uptime + (clock - T0) end
local cooldownStart
function IsPlayerSpell(id) return id == 18560 end -- a tailor: knows Mooncloth
function GetSpellInfo(id) return id == 18560 and "Mooncloth" or nil end
function GetSpellCooldown(id) if id == 18560 and cooldownStart then return cooldownStart, 4 * 86400, 1 end; return 0, 0, 1 end
function GetItemCount() return 0 end
SlashCmdList = {}
function print() end

-- bags (C_Container) and the bank (readable only while open)
local function link(id, name, color) return ("|cff%s|Hitem:%d::::::::|h[%s]|h|r"):format(color, id, name) end
state.containers = {
  [0] = { size = 16, items = { [1] = { 2589, "Linen Cloth", 20, 1, "ffffff" }, [2] = { 858, "Lesser Healing Potion", 4, 1, "ffffff" }, [5] = { 5195, "Gold-flecked Gloves", 1, 2, "1eff00" } } },
  [1] = { size = 6, items = { [3] = { 4338, "Mageweave Cloth", 12, 1, "ffffff" } } },
  [-1] = { size = 24, items = { [1] = { 2589, "Linen Cloth", 40, 1, "ffffff" }, [7] = { 6256, "Fishing Pole", 1, 1, "ffffff" } } },
  [5] = { size = 8, items = { [2] = { 774, "Malachite", 3, 2, "1eff00" } } },
}
state.bankOpen = false
C_Container = {
  GetContainerNumSlots = function(bag)
    if (bag == -1 or bag >= 5) and not state.bankOpen then return 0 end
    local c = state.containers[bag]; return c and c.size or 0
  end,
  GetContainerItemInfo = function(bag, slot)
    if (bag == -1 or bag >= 5) and not state.bankOpen then return nil end
    local c = state.containers[bag]; local it = c and c.items[slot]
    if not it then return nil end
    return { itemID = it[1], stackCount = it[3], quality = it[4], hyperlink = link(it[1], it[2], it[5]) }
  end,
  ContainerIDToInventoryID = function(bag) return 19 + bag end,
}
local baseInventoryLink = GetInventoryItemLink
function GetInventoryItemLink(unit, slot)
  if slot == 20 then return link(4245, "Linen Bag", "ffffff") end -- bag 1
  if slot == 24 then return link(4241, "Green Woolen Bag", "1eff00") end -- bank bag 5
  return baseInventoryLink(unit, slot)
end
NUM_BAG_SLOTS, NUM_BANKBAGSLOTS = 4, 6

-- pets (off until the second session)
state.pet = nil
local baseUnitName, baseUnitLevel, baseUnitGUID = UnitName, UnitLevel, UnitGUID
function UnitName(u) if u == "pet" then return state.pet and state.pet.name end; return baseUnitName(u) end
function UnitLevel(u) if u == "pet" then return state.pet and state.pet.level end; return baseUnitLevel(u) end
function UnitGUID(u) if u == "pet" then return state.pet and "Pet-0-1234" end; return baseUnitGUID(u) end
function UnitExists(u) return u ~= "pet" or state.pet ~= nil end
function UnitCreatureFamily() return state.pet and state.pet.family end
function HasPetUI() return state.pet ~= nil, state.pet ~= nil end
function GetPetExperience() return 1200, 4800 end
function GetPetHappiness() return 3, 125, 2 end
function GetPetLoyalty() return "Loyalty Level 3 (Faithful)" end
function GetPetTrainingPoints() return 120, 85 end
function GetPetIcon() return 132203 end
function HasPetSpells() return state.pet and 2 or 0 end
BOOKTYPE_PET = "pet"
function GetSpellBookItemName(i) return ({ "Bite", "Growl" })[i], ({ "Rank 3", "Rank 2" })[i] end
function GetSpellBookItemInfo() return "SPELL" end
function GetNumStableSlots() return 2 end
function GetStablePetInfo(i) if i == 1 then return 132190, "Fang", 18, "Cat", "Loyalty Level 2" end end

-- Load the way the game does: both files share the addon namespace.
local printed = {}
function print(...) printed[#printed + 1] = table.concat({ ... }, " ") end
function GetLocale() return "enUS" end
date = os.date
local ns = {}
assert(loadfile("addon/WowLocker/WowLocker.lua"))("WowLocker", ns)

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
-- quest accepted (Classic passes the log index + id), then turned in: XP + gold
tick(60); fire("QUEST_ACCEPTED", 2, 155)
tick(60); fire("QUEST_LOG_UPDATE"); fire("QUEST_TURNED_IN", 155, 1650, 3500)
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
-- a bank visit
state.bankOpen = true; fire("BANKFRAME_OPENED"); state.bankOpen = false; fire("BANKFRAME_CLOSED")
state.containers[0].items[2][3] = 3; fire("BAG_UPDATE", 0) -- drank a potion
-- open a mailbox; craft Mooncloth (4-day cooldown); log out in an inn
tick(60); fire("MAIL_INBOX_UPDATE")
tick(30); cooldownStart = GetTime(); fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", 18560)
state.resting = true; fire("PLAYER_UPDATE_RESTING")
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
local first, last = me.events[1], me.events[#me.events]
check(first.type == "login" and first.money ~= nil and first.xp ~= nil, "login records XP and gold")
check(last.type == "logout" and last.money == 12345 and last.xp == s.xp, "logout records the last good XP and gold")
check(count.gear == 2, "both glove swaps recorded")
check(count.loot == 1, "only your own green-or-better loot")
check(count.close_call == 3, "three close calls (a recovery separates them)")
check(count.quest == 1 and me.events[#me.events].type == "logout", "quest turn-in recorded")
local accepted
for _, e in ipairs(me.events) do if e.type == "quest_accept" then accepted = e end end
check(count.quest_accept == 1 and accepted.title == "The Defias Brotherhood" and accepted.level == 18,
  "quest accepted, with its title and level from the log")
check(count.skill == 2, "skill milestone + new skill, not every weapon point")
check(count.reputation == 1, "reputation: Friendly with Stormwind")
check(count.dungeon_enter == 1 and count.dungeon_leave == 1, "one dungeon run despite the /reload")
check(#s.questsCompleted == 3, "completed quests: 2 known + the one turned in")
check(s.mail.hasNew == true and #s.mail.letters == 2, "mailbox: unread flag + 2 letters")
local l1, l2 = s.mail.letters[1], s.mail.letters[2]
check(l1.onExpiry == "returned" and l1.expiresAt == s.mail.readAt + 216000 and l1.items[1].count == 20,
  "player letter with items: returned to sender in 2.5 days")
check(l2.onExpiry == "deleted" and l2.expiresAt == s.mail.readAt + 108000, "auction-house letter: deleted in 1.25 days")
local mc = s.cooldowns[1]
check(#s.cooldowns == 1 and mc.name == "Mooncloth" and mc.readyAt == T0 + 2480 + 4 * 86400,
  "Mooncloth ready 4 days after the craft, as a real time (not GetTime)")
check(s.resting == true, "logged out resting (inn rate for rested XP)")
check(#s.bags == 2 and s.bags[1].name == "Backpack" and s.bags[1].size == 16 and #s.bags[1].items == 3,
  "bags: backpack (16 slots, 3 items) + one bag")
check(s.bags[2].name == "Linen Bag" and s.bags[2].items[1].name == "Mageweave Cloth" and s.bags[2].items[1].count == 12,
  "bag name from its item, items with names and counts")
check(s.bags[1].items[2].count == 3, "a used potion updates the bags")
check(s.bank and #s.bank.containers == 2 and s.bank.containers[1].name == "Bank" and s.bank.containers[2].name == "Green Woolen Bag",
  "bank: main + one bank bag, saved on the visit")
check(s.bank.containers[1].items[1].count == 40, "bank kept after the bank closed (not wiped by later bag reads)")

-- WL_DUMP=path: write WowLockerDB as JSON (what the companion uploads) — the
-- API's tests use it as a fixture, so both sides agree on the format.
local dump = os.getenv("WL_DUMP")
if dump then
  local function enc(v)
    local t = type(v)
    if t == "nil" then return "null" end
    if t == "boolean" or t == "number" then return tostring(v) end
    if t == "string" then return '"' .. v:gsub('[%c"\\]', function(c) return string.format("\\u%04x", c:byte()) end) .. '"' end
    local n = #v
    if n > 0 or next(v) == nil then
      local out = {}
      for i = 1, n do out[i] = enc(v[i]) end
      return "[" .. table.concat(out, ",") .. "]"
    end
    local keys, out = {}, {}
    for k in pairs(v) do keys[#keys + 1] = tostring(k) end
    table.sort(keys)
    for _, k in ipairs(keys) do
      local val = v[k]
      if val == nil then val = v[tonumber(k)] end -- (not `and/or`: it turns false into nil)
      out[#out + 1] = enc(k) .. ":" .. enc(val)
    end
    return "{" .. table.concat(out, ",") .. "}"
  end
  local fh = assert(io.open(dump, "w"))
  fh:write(enc(WowLockerDB))
  fh:close()
  io.write("wrote " .. dump .. "\n")
end

-- ── settings: what to record ──
check(printed[1] and printed[1]:find("recording Namzie") ~= nil, "login message in chat")
local before = #me.events
WowLockerSettings.record.loot = false
fire("CHAT_MSG_LOOT", "You receive loot: |cff0070dd|Hitem:5:0|h[Blue Thing]|h|r.")
check(#me.events == before, "loot not recorded when turned off")
WowLockerSettings.record.loot, WowLockerSettings.lootQuality = true, 3
fire("CHAT_MSG_LOOT", "You receive loot: |cff1eff00|Hitem:6:0|h[Green Thing]|h|r.")
fire("CHAT_MSG_LOOT", "You receive loot: |cff0070dd|Hitem:5:0|h[Blue Thing]|h|r.")
check(#me.events == before + 1 and me.events[#me.events].name == "Blue Thing", "loot from Rare up: green skipped, blue kept")
WowLockerSettings.closeCall, WowLockerSettings.chatConfirm = 0.25, true
local nprinted = #printed
state.dead = false; state.hp = 76; fire("UNIT_HEALTH", "player") -- 20%
check(me.events[#me.events].type == "close_call" and #printed == nprinted + 1, "close call at 20% with a 25% threshold, confirmed in chat")
state.hp = 380; fire("UNIT_HEALTH", "player")
WowLockerSettings.chatConfirm, WowLockerSettings.lootQuality, WowLockerSettings.closeCall = false, 2, 0.15
for _ = 1, #me.events - before do table.remove(me.events) end -- keep the dumps below unchanged

-- every event reads as a line (event log, chat confirmations)
for _, e in ipairs(me.events) do
  local text = ns.formatEvent(e)
  assert(type(text) == "string" and text ~= "" and not text:find("nil"), "bad line for " .. e.type)
end
check(true, "every recorded event formats as a log line")

-- ── Options.lua against a permissive fake UI: builds, fills, refreshes ──
do
  local function mock()
    local m = { scripts = {}, lines = {}, text = "" }
    return setmetatable(m, { __index = function(t, k)
      if not k:match("^%u") or k == "TitleText" or k == "Text" then return nil end -- WoW methods are capitalised
      local f = function(self, ...)
        if k == "SetScript" then local name, fn = ...; self.scripts[name] = fn
        elseif k == "AddMessage" then self.lines[#self.lines + 1] = ...
        elseif k == "Clear" then self.lines = {}
        elseif k == "SetText" then self.text = ...
        elseif k == "GetStringWidth" then return 40
        elseif k == "GetChecked" then return self.checked
        elseif k == "SetChecked" then self.checked = ...
        elseif k == "GetID" then return 1
        elseif k == "IsShown" then return self.shown
        elseif k == "Show" then self.shown = true; if self.scripts.OnShow then self.scripts.OnShow(self) end
        elseif k == "Hide" then self.shown = false
        elseif k == "CreateFontString" then return mock()
        end
        return nil
      end
      rawset(t, k, f)
      return f
    end })
  end
  local made = {}
  CreateFrame = function(kind, name, parent, template)
    local m = mock()
    m.kind, m.template = kind, template
    made[#made + 1] = m
    if name then _G[name] = m end
    return m
  end
  UIParent, ChatFontNormal, GameTooltip, UISpecialFrames = mock(), mock(), mock(), {}
  local registered
  Settings = {
    RegisterCanvasLayoutCategory = function(frame, title) registered = { frame = frame, title = title }; return mock() end,
    RegisterAddOnCategory = function() end,
    OpenToCategory = function() registered.opened = true end,
  }
  function InCombatLockdown() return false end
  function IsShiftKeyDown() return false end
  assert(loadfile("addon/WowLocker/Options.lua"))("WowLocker", ns)
  check(registered and registered.title == "WoWLocker", "settings panel registered under AddOns")

  ns.toggleLog()
  local log
  for _, m in ipairs(made) do if m.kind == "ScrollingMessageFrame" then log = m end end
  check(log and #log.lines == #me.events, "event log window lists every event")
  fire("CHAT_MSG_LOOT", "You receive loot: |cffa335ee|Hitem:7:0|h[Purple Thing]|h|r.")
  check(#log.lines == #me.events, "a new event appears in the open log")
  table.remove(me.events)

  registered.frame.scripts.OnShow(registered.frame) -- open the panel: builds and refreshes widgets
  local boxes = 0
  for _, m in ipairs(made) do if m.kind == "CheckButton" then boxes = boxes + 1 end end
  check(boxes == 2 + 11 + 4 + 3, "options panel: 2 chat, 11 record, 4 threshold, 3 loot quality checkboxes")
  SlashCmdList.WOWLOCKER("options")
  check(registered.opened, "/wowlocker options opens the panel")
end

-- WL_SV=path: write WowLockerDB the way the game writes SavedVariables (keys
-- in brackets, "-- [n]" after array items, %q strings): the companion's
-- parser is tested against it.
local sv = os.getenv("WL_SV")
if sv then
  local function ser(v, indent)
    local t = type(v)
    if t == "string" then return ("%q"):format(v) end
    if t ~= "table" then return tostring(v) end
    local out, n = { "{" }, #v
    for i = 1, n do out[#out + 1] = indent .. "\t" .. ser(v[i], indent .. "\t") .. ", -- [" .. i .. "]" end
    local keys = {}
    for k in pairs(v) do if not (type(k) == "number" and k >= 1 and k <= n) then keys[#keys + 1] = k end end
    table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
    for _, k in ipairs(keys) do
      local key = type(k) == "string" and ("[%q]"):format(k) or ("[" .. tostring(k) .. "]")
      out[#out + 1] = indent .. "\t" .. key .. " = " .. ser(v[k], indent .. "\t") .. ","
    end
    out[#out + 1] = indent .. "}"
    return table.concat(out, "\n")
  end
  local fh = assert(io.open(sv, "w"))
  fh:write("\nWowLockerDB = " .. ser(WowLockerDB, "") .. "\n")
  fh:close()
  io.write("wrote " .. sv .. "\n")
end

-- ── second session: things that must NOT be recorded ──
local before = #me.events
local function newEvents()
  local out = {}
  for i = before + 1, #me.events do out[#out + 1] = me.events[i] end
  return out
end
local function ofType(list, t) local n = 0; for _, e in ipairs(list) do if e.type == t then n = n + 1 end end; return n end
tick(3600)
state.xp, state.xpMax, state.rested, state.money = 100, 28000, 0, 12000
-- in a guild whose name only arrives after PLAYER_LOGIN
state.guild, state.guildLoading = "Les Gnomes", true
-- the Professions header is collapsed at login: Cooking and First Aid are hidden
local profs = { state.skills[2], state.skills[5] }
table.remove(state.skills, 5); table.remove(state.skills, 2)
fire("PLAYER_LOGIN"); fire("PLAYER_ENTERING_WORLD")
state.guildLoading = false; fire("PLAYER_GUILD_UPDATE")
tick(60); state.level = 24; fire("PLAYER_LEVEL_UP", 24); fire("CHARACTER_POINTS_CHANGED") -- an unspent point, no change
table.insert(state.skills, 2, profs[1]); table.insert(state.skills, 3, profs[2]); fire("SKILL_LINES_CHANGED") -- header expanded
table.insert(state.skills, { "Herbalism", false, 1, 75 }); fire("SKILL_LINES_CHANGED") -- really learned
tick(60); state.talents[3][2] = 11; fire("CHARACTER_POINTS_CHANGED") -- a point spent
state.guild = nil; fire("PLAYER_GUILD_UPDATE") -- left the guild
local ev = newEvents()
check(ofType(ev, "guild") == 1 and ev[#ev].type == "guild" and ev[#ev].from == "Les Gnomes",
  "guild name loading after login isn't a change; leaving it is")
check(ofType(ev, "talent") == 1, "a level-up's unspent point isn't a talent change; spending it is")
check(ofType(ev, "skill") == 1 and ev[1].type ~= "skill", "expanding a header isn't learning; Herbalism is")
-- ── pets: tame one, it levels, the stable, it dies ──
before = #me.events
state.pet = { name = "Wolfy", family = "Wolf", level = 23 }
fire("UNIT_PET", "player")
local p = me.state.pet
check(p and p.name == "Wolfy" and p.family == "Wolf" and p.xp == 1200 and p.xpMax == 4800 and p.happiness == 3
  and p.loyalty:find("Faithful") and p.trainingPoints == 120 and p.icon == 132203,
  "pet: name, family, XP, happiness, loyalty, training points, icon")
check(#p.abilities == 2 and p.abilities[1] == "Bite (Rank 3)", "pet abilities with ranks")
state.pet.level = 24; fire("UNIT_LEVEL", "pet")
fire("PET_STABLE_SHOW")
check(me.state.stable and #me.state.stable.pets == 1 and me.state.stable.pets[1].name == "Fang", "stable saved on a visit")
combat = { 0, "UNIT_DIED", false, "", "", 0, 0, "Pet-0-1234", "Wolfy", 0, 0 }
fire("COMBAT_LOG_EVENT_UNFILTERED")
local ev = newEvents()
check(ofType(ev, "pet_new") == 1 and ofType(ev, "pet_level") == 1 and ofType(ev, "pet_death") == 1,
  "pet events: new, level, death")
local pd; for _, e in ipairs(ev) do if e.type == "pet_death" then pd = e end end
check(pd.mapId == 1436 and pd.x and pd.level == 24, "pet death with its place on the map")
state.pet = nil; fire("UNIT_PET", "player")
check(me.state.pet and me.state.pet.active == false and me.state.pet.name == "Wolfy", "a dismissed pet is kept, marked inactive")
-- deaths carry the map; no position means no stale coordinates
local deaths = {}
for _, e in ipairs(me.events) do if e.type == "death" then deaths[#deaths + 1] = e end end
check(deaths[1].mapId == 1436, "a death records its map id")
local baseMapPos = C_Map.GetPlayerMapPosition
C_Map.GetPlayerMapPosition = function() return nil end
fire("ZONE_CHANGED_NEW_AREA")
check(me.state.x == nil and me.state.y == nil, "no position from the game: no stale coordinates")
C_Map.GetPlayerMapPosition = baseMapPos
fire("ZONE_CHANGED_NEW_AREA")
-- logging out: the game no longer gives a map; the last position must survive
local baseBestMap = C_Map.GetBestMapForUnit
C_Map.GetBestMapForUnit = function() return nil end
fire("PLAYER_LOGOUT")
check(me.state.mapId == 1436 and me.state.x == 42.1 and me.state.y == 74.6, "logout without a map keeps the last position")
C_Map.GetBestMapForUnit = baseBestMap
fire("PLAYER_LOGIN"); fire("PLAYER_ENTERING_WORLD")

-- into the Deadmines, log out inside, come back 8 hours later (instance reset)
before = #me.events
tick(60); state.instance = { true, "party" }; fire("PLAYER_ENTERING_WORLD")
tick(900); fire("PLAYER_LOGOUT")
tick(8 * 3600); fire("PLAYER_LOGIN"); fire("PLAYER_ENTERING_WORLD")
ev = newEvents()
local leave
for _, e in ipairs(ev) do if e.type == "dungeon_leave" then leave = e end end
check(ofType(ev, "dungeon_enter") == 2 and leave and leave.duration == 900,
  "logging back into an instance hours later: the old run ended at logout, a new one starts")
-- …whereas a quick reconnect continues the run
before = #me.events
tick(300); fire("PLAYER_LOGOUT"); tick(60); fire("PLAYER_LOGIN"); fire("PLAYER_ENTERING_WORLD")
check(ofType(newEvents(), "dungeon_leave") == 0 and me.state.run and me.state.run.loggedOutAt == nil,
  "a reconnect within 30 minutes continues the run")
