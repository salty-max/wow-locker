-- wow-locker: records what the Battle.net API can't see.
--
-- Addons have no network access. Everything goes into the WowLockerDB
-- SavedVariables table, which the game writes to disk on logout, /reload or
-- disconnect; the wow-locker companion app watches that file and uploads it.
--
-- Data layout (format version 1):
--   WowLockerDB = {
--     format = 1,
--     characters = {
--       [playerGUID] = {
--         name, realm, class, race, faction,
--         events = { { t = unixTime, type = "...", ... }, ... },  -- oldest first
--         state  = { level, xp, xpMax, rested, money, playedTotal, playedLevel,
--                    zone, subZone, mapId, x, y, guild, hardcore, updatedAt },
--       },
--     },
--   }

local MAX_EVENTS = 5000 -- per character; the companion uploads long before this matters

local f = CreateFrame("Frame")
local me -- this character's record
local playerGUID
local lastAttacker -- { name, spell, t } — the last thing that damaged us (death cause)
local lastTalents -- points per tree, to tell a respec from a new point
local lastGuild
local ready = false

local SLOT_NAMES = {
  [1] = "HEAD", [2] = "NECK", [3] = "SHOULDER", [4] = "SHIRT", [5] = "CHEST", [6] = "WAIST",
  [7] = "LEGS", [8] = "FEET", [9] = "WRIST", [10] = "HANDS", [11] = "FINGER_1", [12] = "FINGER_2",
  [13] = "TRINKET_1", [14] = "TRINKET_2", [15] = "BACK", [16] = "MAIN_HAND", [17] = "OFF_HAND",
  [18] = "RANGED", [19] = "TABARD",
}

-- "|cff1eff00|Hitem:4564:...|h[Spiked Club of the Boar]|h|r" → 4564, "Spiked Club of the Boar", "1eff00"
local function parseItemLink(link)
  if not link then return nil end
  local color = link:match("|cff(%x%x%x%x%x%x)")
  local id = tonumber(link:match("|Hitem:(%d+)"))
  local name = link:match("|h%[(.-)%]|h")
  return id, name, color
end

local function record(event)
  if not me then return end
  event.t = time()
  table.insert(me.events, event)
  if #me.events > MAX_EVENTS then table.remove(me.events, 1) end
end

local function talentPoints()
  local points = {}
  for tab = 1, GetNumTalentTabs() do
    local name, _, spent = GetTalentTabInfo(tab)
    points[#points + 1] = { name = name, points = spent or 0 }
  end
  return points
end

local function location()
  local s = me.state
  s.zone = GetRealZoneText()
  s.subZone = GetSubZoneText()
  local mapId = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
  s.mapId = mapId
  if mapId then
    local pos = C_Map.GetPlayerMapPosition(mapId, "player")
    if pos then
      s.x, s.y = math.floor(pos.x * 1000 + 0.5) / 10, math.floor(pos.y * 1000 + 0.5) / 10
    end
  end
end

local function snapshot()
  local s = me.state
  s.level = UnitLevel("player")
  s.xp = UnitXP("player")
  s.xpMax = UnitXPMax("player")
  s.rested = GetXPExhaustion() or 0
  s.money = GetMoney()
  s.guild = GetGuildInfo("player")
  s.hardcore = C_GameRules and C_GameRules.IsHardcoreActive and C_GameRules.IsHardcoreActive() or nil
  location()
  s.updatedAt = time()
end

-- /played without spamming the chat: hide the default chat frames' handler for
-- the one answer we asked for.
local quietPlayed = false
local function requestPlayedQuietly()
  quietPlayed = true
  for i = 1, NUM_CHAT_WINDOWS do
    local cf = _G["ChatFrame" .. i]
    if cf then cf:UnregisterEvent("TIME_PLAYED_MSG") end
  end
  RequestTimePlayed()
end

local function restoreChatPlayed()
  if not quietPlayed then return end
  quietPlayed = false
  for i = 1, NUM_CHAT_WINDOWS do
    local cf = _G["ChatFrame" .. i]
    if cf then cf:RegisterEvent("TIME_PLAYED_MSG") end
  end
end

local function init()
  playerGUID = UnitGUID("player")
  WowLockerDB = WowLockerDB or {}
  WowLockerDB.format = 1
  WowLockerDB.characters = WowLockerDB.characters or {}
  local db = WowLockerDB.characters
  db[playerGUID] = db[playerGUID] or { events = {}, state = {} }
  me = db[playerGUID]
  me.name = UnitName("player")
  me.realm = GetRealmName()
  me.class = select(2, UnitClass("player"))
  me.race = select(2, UnitRace("player"))
  me.faction = UnitFactionGroup("player")

  -- Baselines: changes are recorded against these, so logging in isn't an event.
  lastTalents = talentPoints()
  lastGuild = GetGuildInfo("player")
  snapshot()
  record({ type = "login", level = me.state.level })
  requestPlayedQuietly()
  ready = true
end

f:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    init()
    return
  end
  if not ready then return end

  if event == "PLAYER_EQUIPMENT_CHANGED" then
    local slot = ...
    local slotName = SLOT_NAMES[slot]
    if not slotName then return end
    local id, name, color = parseItemLink(GetInventoryItemLink("player", slot))
    record({ type = "gear", slot = slotName, itemId = id, name = name, color = color })

  elseif event == "PLAYER_LEVEL_UP" then
    local level = ...
    record({ type = "level", level = level })
    -- The answer (time played at this level) lands in TIME_PLAYED_MSG.
    requestPlayedQuietly()

  elseif event == "CHARACTER_POINTS_CHANGED" then
    local now = talentPoints()
    local lost = false
    for i, tree in ipairs(lastTalents) do
      if now[i] and now[i].points < tree.points then lost = true end
    end
    record({ type = lost and "respec" or "talent", trees = now })
    lastTalents = now

  elseif event == "PLAYER_GUILD_UPDATE" then
    local guild = GetGuildInfo("player")
    -- The guild name is briefly nil while the roster loads: only record real changes.
    if guild ~= lastGuild and (guild or not IsInGuild()) then
      record({ type = "guild", from = lastGuild, to = guild })
      lastGuild = guild
    end

  elseif event == "COMBAT_LOG_EVENT_UNFILTERED" then
    local _, sub, _, _, sourceName, _, _, destGUID, _, _, _, a12, a13 = CombatLogGetCurrentEventInfo()
    if destGUID ~= playerGUID then return end
    if sub == "ENVIRONMENTAL_DAMAGE" then
      lastAttacker = { name = a12, environmental = true, t = time() } -- "Falling", "Drowning", "Lava"…
    elseif sub == "SWING_DAMAGE" then
      lastAttacker = { name = sourceName, t = time() }
    elseif sub:match("_DAMAGE$") then
      lastAttacker = { name = sourceName, spell = a13, t = time() }
    end

  elseif event == "PLAYER_DEAD" then
    location()
    local killer = lastAttacker and time() - lastAttacker.t < 30 and lastAttacker or nil
    record({
      type = "death",
      level = UnitLevel("player"),
      killer = killer and killer.name,
      spell = killer and killer.spell,
      environmental = killer and killer.environmental,
      zone = me.state.zone,
      subZone = me.state.subZone,
      x = me.state.x,
      y = me.state.y,
      hardcore = me.state.hardcore,
    })
    requestPlayedQuietly()

  elseif event == "TIME_PLAYED_MSG" then
    local total, thisLevel = ...
    me.state.playedTotal, me.state.playedLevel = total, thisLevel
    C_Timer.After(0, restoreChatPlayed)

  elseif event == "PLAYER_MONEY" or event == "PLAYER_XP_UPDATE" or event == "UPDATE_EXHAUSTION" then
    snapshot()

  elseif event == "ZONE_CHANGED_NEW_AREA" then
    location()

  elseif event == "PLAYER_LOGOUT" then
    snapshot()
    record({ type = "logout", level = me.state.level })
  end
end)

for _, e in ipairs({
  "PLAYER_LOGIN", "PLAYER_LOGOUT", "PLAYER_EQUIPMENT_CHANGED", "PLAYER_LEVEL_UP", "CHARACTER_POINTS_CHANGED",
  "PLAYER_GUILD_UPDATE", "COMBAT_LOG_EVENT_UNFILTERED", "PLAYER_DEAD", "TIME_PLAYED_MSG", "PLAYER_MONEY",
  "PLAYER_XP_UPDATE", "UPDATE_EXHAUSTION", "ZONE_CHANGED_NEW_AREA",
}) do
  f:RegisterEvent(e)
end

-- /wowlocker: a quick look at what's recorded for this character.
SLASH_WOWLOCKER1 = "/wowlocker"
SlashCmdList.WOWLOCKER = function()
  if not me then return end
  local s = me.state
  print(("|cffffd100wow-locker|r: %d events recorded for %s. Level %d, %d/%d XP (+%d rested), %s, in %s."):format(
    #me.events, me.name, s.level or 0, s.xp or 0, s.xpMax or 0, s.rested or 0,
    GetCoinTextureString and GetCoinTextureString(s.money or 0) or tostring(s.money), s.zone or "?"))
  print("|cffffd100wow-locker|r: data is written to disk on logout or /reload; the companion app uploads it.")
end
