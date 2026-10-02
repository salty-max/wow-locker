-- wow-locker: records what the Battle.net API can't see.
--
-- Addons have no network access. Everything goes into the WowLockerDB
-- SavedVariables table, which the game writes to disk on logout, /reload or
-- disconnect; the wow-locker companion app watches that file and uploads it.
--
-- Data layout (format 1):
--   WowLockerDB = {
--     format = 1,
--     characters = {
--       [playerGUID] = {                -- "Player-<API realm id>-<hex API character id>"
--         name, realm, class, race, faction,
--         events = { { t = unixTime, type = "...", ... }, ... },   -- oldest first
--         state  = { level, xp, xpMax, rested, money, playedTotal, playedLevel,
--                    zone, subZone, mapId, x, y, guild, hardcore, updatedAt,
--                    levelPlayed = { [level] = playedTotalWhenReached },
--                    questsCompleted = { questId, ... }, skills = { … },
--                    reputations = { … }, run = currentDungeonRun },
--       },
--     },
--   }
--
-- Event types: login, logout, gear, level, talent, respec, guild, death,
-- quest, close_call, dungeon_enter, dungeon_leave, loot, skill, reputation.

local MAX_EVENTS = 5000 -- per character; the companion uploads long before this matters
local CLOSE_CALL = 0.15 -- health fraction that counts as a Hardcore close call
local CLOSE_CALL_RESET = 0.5 -- …and has to be climbed back above before the next one
local SKILL_STEP = 25 -- skill milestones (weapon skills rise constantly)
local LOOT_COLORS = { ["1eff00"] = true, ["0070dd"] = true, ["a335ee"] = true, ["ff8000"] = true } -- uncommon+

local f = CreateFrame("Frame")
local me -- this character's record
local playerGUID
local ready = false

local lastAttacker -- { name, spell, environmental, t }: the last thing that damaged us
local lastTalents -- points per tree: a respec is points leaving a tree
local lastGuild
local questTitles = {} -- questId → title, learned from the quest log
local closeCall -- the open close-call event (lowest health is updated in place)
local pendingLevel -- the level event waiting for its /played answer
local lastSkills, lastStandings

local SLOT_NAMES = {
  [1] = "HEAD", [2] = "NECK", [3] = "SHOULDER", [4] = "SHIRT", [5] = "CHEST", [6] = "WAIST",
  [7] = "LEGS", [8] = "FEET", [9] = "WRIST", [10] = "HANDS", [11] = "FINGER_1", [12] = "FINGER_2",
  [13] = "TRINKET_1", [14] = "TRINKET_2", [15] = "BACK", [16] = "MAIN_HAND", [17] = "OFF_HAND",
  [18] = "RANGED", [19] = "TABARD",
}

-- ── helpers ──────────────────────────────────────────────────────────────────

-- "|cff1eff00|Hitem:4564:...|h[Spiked Club of the Boar]|h|r" → 4564, "Spiked Club of the Boar", "1eff00"
local function parseItemLink(link)
  if not link then return nil end
  local color = link:match("|cff(%x%x%x%x%x%x)")
  local id = tonumber(link:match("|Hitem:(%d+)"))
  local name = link:match("|h%[(.-)%]|h")
  return id, name, color
end

-- A global format string ("You receive loot: %s.") as a Lua pattern.
local function formatToPattern(fmt)
  if not fmt then return nil end
  local p = fmt:gsub("([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
  p = p:gsub("%%%%s", "(.+)"):gsub("%%%%d", "(%%d+)")
  return "^" .. p .. "$"
end

local function record(event)
  if not me then return end
  event.t = time()
  table.insert(me.events, event)
  if #me.events > MAX_EVENTS then table.remove(me.events, 1) end
  return event
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

-- Refresh the state. By PLAYER_LOGOUT the client has already cleared XP and
-- money (they read 0), so the final snapshot (`final`) keeps the last good
-- values and only refreshes time and location; a 0 max XP is never trusted.
local function snapshot(final)
  local s = me.state
  s.updatedAt = time()
  if final then
    if GetRealZoneText() ~= "" then location() end
    return
  end
  s.level = UnitLevel("player")
  local xpMax = UnitXPMax("player")
  if xpMax and xpMax > 0 then
    s.xp = UnitXP("player")
    s.xpMax = xpMax
    s.rested = GetXPExhaustion() or 0
  end
  s.money = GetMoney()
  s.guild = GetGuildInfo("player")
  s.hardcore = C_GameRules and C_GameRules.IsHardcoreActive and C_GameRules.IsHardcoreActive() or nil
  location()
end

local function talentPoints()
  local points = {}
  for tab = 1, GetNumTalentTabs() do
    local name, _, spent = GetTalentTabInfo(tab)
    points[#points + 1] = { name = name, points = spent or 0 }
  end
  return points
end

-- ── quests ───────────────────────────────────────────────────────────────────

-- Titles come from the quest log (reliable on every client); remembered so a
-- turn-in still has its name once the quest has left the log.
local function learnQuestTitles()
  for i = 1, GetNumQuestLogEntries() do
    local title, _, _, isHeader, _, _, _, questId = GetQuestLogTitle(i)
    if not isHeader and questId and title then questTitles[questId] = title end
  end
end

local function completedQuests()
  local done
  if C_QuestLog and C_QuestLog.GetAllCompletedQuestIDs then
    done = C_QuestLog.GetAllCompletedQuestIDs()
  elseif GetQuestsCompleted then
    local set = GetQuestsCompleted()
    done = {}
    for id in pairs(set) do done[#done + 1] = id end
  end
  if done then table.sort(done) end
  return done
end

-- ── skills & reputation ──────────────────────────────────────────────────────

-- Only expanded sections are visible to addons; we never expand the player's UI.
local function readSkills()
  local skills, section = {}, nil
  for i = 1, GetNumSkillLines() do
    local name, isHeader, _, rank, _, _, maxRank = GetSkillLineInfo(i)
    if isHeader then
      section = name
    elseif name then
      skills[name] = { section = section, rank = rank or 0, max = maxRank or 0 }
    end
  end
  return skills
end

local function readStandings()
  local reps = {}
  for i = 1, GetNumFactions() do
    local name, _, standingId, barMin, barMax, barValue, _, _, isHeader, _, hasRep = GetFactionInfo(i)
    if name and (not isHeader or hasRep) then
      reps[name] = { standing = standingId, value = barValue - barMin, max = barMax - barMin }
    end
  end
  return reps
end

local function storeSkillsAndReps()
  local list = {}
  for name, s in pairs(lastSkills or {}) do
    list[#list + 1] = { name = name, section = s.section, rank = s.rank, max = s.max }
  end
  me.state.skills = list
  local reps = {}
  for name, r in pairs(lastStandings or {}) do
    reps[#reps + 1] = { name = name, standing = r.standing, value = r.value, max = r.max }
  end
  me.state.reputations = reps
end

-- ── dungeon runs ─────────────────────────────────────────────────────────────

local function groupNames()
  local names = {}
  local prefix = IsInRaid and IsInRaid() and "raid" or "party"
  for i = 1, (GetNumGroupMembers and GetNumGroupMembers() or 0) do
    local n = UnitName(prefix .. i)
    if n and n ~= UnitName("player") then names[#names + 1] = n end
  end
  return names
end

local function checkInstance()
  local inInstance, kind = IsInInstance()
  local s = me.state
  local name = inInstance and GetInstanceInfo() or nil
  local dungeon = inInstance and (kind == "party" or kind == "raid")
  if s.run and (not dungeon or s.run.name ~= name) then
    local run = s.run
    record({
      type = "dungeon_leave",
      name = run.name,
      kind = run.kind,
      duration = time() - run.startedAt,
      deaths = run.deaths,
      closeCalls = run.closeCalls,
      group = run.group,
    })
    s.run = nil
  end
  -- Same instance after a /reload: the run simply continues.
  if dungeon and not s.run then
    s.run = { name = name, kind = kind, startedAt = time(), deaths = 0, closeCalls = 0, group = groupNames() }
    record({ type = "dungeon_enter", name = name, kind = kind, level = UnitLevel("player"), group = s.run.group })
  end
end

-- ── /played without spamming the chat ────────────────────────────────────────

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

-- ── loot ─────────────────────────────────────────────────────────────────────

local LOOT_PATTERNS -- built once from the client's own (localized) strings

local function lootPatterns()
  if LOOT_PATTERNS then return LOOT_PATTERNS end
  LOOT_PATTERNS = {}
  for _, entry in ipairs({
    { _G.LOOT_ITEM_SELF_MULTIPLE, "loot" },
    { _G.LOOT_ITEM_SELF, "loot" },
    { _G.LOOT_ITEM_PUSHED_SELF_MULTIPLE, "received" },
    { _G.LOOT_ITEM_PUSHED_SELF, "received" },
    { _G.LOOT_ITEM_CREATED_SELF_MULTIPLE, "created" },
    { _G.LOOT_ITEM_CREATED_SELF, "created" },
  }) do
    local p = formatToPattern(entry[1])
    if p then LOOT_PATTERNS[#LOOT_PATTERNS + 1] = { p, entry[2] } end
  end
  return LOOT_PATTERNS
end

-- ── init ─────────────────────────────────────────────────────────────────────

local function init()
  playerGUID = UnitGUID("player")
  WowLockerDB = WowLockerDB or {}
  WowLockerDB.format = 1
  WowLockerDB.characters = WowLockerDB.characters or {}
  local db = WowLockerDB.characters
  db[playerGUID] = db[playerGUID] or { events = {}, state = {} }
  me = db[playerGUID]
  me.state.levelPlayed = me.state.levelPlayed or {}
  me.name = UnitName("player")
  me.realm = GetRealmName()
  me.class = select(2, UnitClass("player"))
  me.race = select(2, UnitRace("player"))
  me.faction = UnitFactionGroup("player")

  -- Baselines: changes are recorded against these, so logging in isn't an event.
  lastTalents = talentPoints()
  lastGuild = GetGuildInfo("player")
  lastSkills = readSkills()
  lastStandings = readStandings()
  storeSkillsAndReps()
  learnQuestTitles()
  me.state.questsCompleted = completedQuests()
  snapshot()
  record({ type = "login", level = me.state.level })
  requestPlayedQuietly()
  ready = true
end

-- ── events ───────────────────────────────────────────────────────────────────

local handlers = {}

function handlers.PLAYER_EQUIPMENT_CHANGED(slot)
  local slotName = SLOT_NAMES[slot]
  if not slotName then return end
  local id, name, color = parseItemLink(GetInventoryItemLink("player", slot))
  record({ type = "gear", slot = slotName, itemId = id, name = name, color = color })
end

function handlers.PLAYER_LEVEL_UP(level)
  pendingLevel = record({ type = "level", level = level })
  requestPlayedQuietly() -- the answer stamps the event with /played at this level
end

function handlers.CHARACTER_POINTS_CHANGED()
  local now = talentPoints()
  local lost = false
  for i, tree in ipairs(lastTalents) do
    if now[i] and now[i].points < tree.points then lost = true end
  end
  record({ type = lost and "respec" or "talent", trees = now })
  lastTalents = now
end

function handlers.PLAYER_GUILD_UPDATE()
  local guild = GetGuildInfo("player")
  -- The guild name is briefly nil while the roster loads: only record real changes.
  if guild ~= lastGuild and (guild or not IsInGuild()) then
    record({ type = "guild", from = lastGuild, to = guild })
    lastGuild = guild
  end
end

function handlers.COMBAT_LOG_EVENT_UNFILTERED()
  local _, sub, _, _, sourceName, _, _, destGUID, _, _, _, a12, a13 = CombatLogGetCurrentEventInfo()
  if destGUID ~= playerGUID then return end
  if sub == "ENVIRONMENTAL_DAMAGE" then
    lastAttacker = { name = a12, environmental = true, t = time() } -- "Falling", "Drowning", "Lava"…
  elseif sub == "SWING_DAMAGE" then
    lastAttacker = { name = sourceName, t = time() }
  elseif sub:match("_DAMAGE$") then
    lastAttacker = { name = sourceName, spell = a13, t = time() }
  end
end

function handlers.UNIT_HEALTH(unit)
  if unit ~= "player" or UnitIsDeadOrGhost("player") then return end
  local max = UnitHealthMax("player")
  if not max or max == 0 then return end
  local frac = UnitHealth("player") / max
  local pct = math.floor(frac * 100 + 0.5)
  if closeCall then
    if frac >= CLOSE_CALL_RESET then
      closeCall = nil -- survived: the next dip is a new close call
    elseif pct < closeCall.pct then
      closeCall.pct = pct -- deeper into the same one
    end
  elseif frac > 0 and frac < CLOSE_CALL then
    location()
    local attacker = lastAttacker and time() - lastAttacker.t < 10 and lastAttacker or nil
    closeCall = record({
      type = "close_call",
      pct = pct,
      level = UnitLevel("player"),
      attacker = attacker and attacker.name,
      spell = attacker and attacker.spell,
      zone = me.state.zone,
      subZone = me.state.subZone,
      instance = me.state.run and me.state.run.name,
    })
    if me.state.run then me.state.run.closeCalls = me.state.run.closeCalls + 1 end
  end
end

function handlers.PLAYER_DEAD()
  location()
  closeCall = nil
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
    instance = me.state.run and me.state.run.name,
    hardcore = me.state.hardcore,
  })
  if me.state.run then me.state.run.deaths = me.state.run.deaths + 1 end
  requestPlayedQuietly()
end

function handlers.TIME_PLAYED_MSG(total, thisLevel)
  me.state.playedTotal, me.state.playedLevel = total, thisLevel
  if pendingLevel then
    pendingLevel.played = total
    me.state.levelPlayed[pendingLevel.level] = total
    pendingLevel = nil
  end
  C_Timer.After(0, restoreChatPlayed)
end

function handlers.QUEST_LOG_UPDATE()
  learnQuestTitles()
end

function handlers.QUEST_TURNED_IN(questId, xp, money)
  record({ type = "quest", questId = questId, title = questTitles[questId], xp = xp, money = money })
  local done = me.state.questsCompleted
  if done then done[#done + 1] = questId end
end

function handlers.CHAT_MSG_LOOT(text)
  for _, entry in ipairs(lootPatterns()) do
    local link, count = text:match(entry[1])
    if link then
      local id, name, color = parseItemLink(link)
      if id and LOOT_COLORS[color] then
        record({ type = "loot", itemId = id, name = name, color = color, count = tonumber(count) or 1, how = entry[2] })
      end
      return
    end
  end
end

function handlers.SKILL_LINES_CHANGED()
  local now = readSkills()
  for name, s in pairs(now) do
    local before = lastSkills and lastSkills[name]
    if not before then
      if lastSkills and next(lastSkills) then -- not the first read
        record({ type = "skill", name = name, section = s.section, rank = s.rank, max = s.max, learned = true })
      end
    elseif math.floor(s.rank / SKILL_STEP) > math.floor(before.rank / SKILL_STEP) then
      record({ type = "skill", name = name, section = s.section, rank = s.rank, max = s.max })
    end
  end
  lastSkills = now
  storeSkillsAndReps()
end

function handlers.UPDATE_FACTION()
  local now = readStandings()
  for name, r in pairs(now) do
    local before = lastStandings and lastStandings[name]
    if before and r.standing > before.standing then
      record({
        type = "reputation",
        faction = name,
        standing = r.standing,
        label = _G["FACTION_STANDING_LABEL" .. r.standing],
      })
    end
  end
  lastStandings = now
  storeSkillsAndReps()
end

function handlers.PLAYER_ENTERING_WORLD()
  snapshot()
  checkInstance()
end

function handlers.ZONE_CHANGED_NEW_AREA()
  location()
  checkInstance()
end

local function refresh() snapshot() end
handlers.PLAYER_MONEY = refresh
handlers.PLAYER_XP_UPDATE = refresh
handlers.UPDATE_EXHAUSTION = refresh

function handlers.PLAYER_LOGOUT()
  snapshot(true)
  record({ type = "logout", level = me.state.level })
end

f:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    init()
    return
  end
  if ready and handlers[event] then handlers[event](...) end
end)

f:RegisterEvent("PLAYER_LOGIN")
for event in pairs(handlers) do
  if event == "UNIT_HEALTH" then
    f:RegisterUnitEvent(event, "player") -- not every party member and target
  else
    f:RegisterEvent(event)
  end
end

-- /wowlocker: a quick look at what's recorded for this character.
SLASH_WOWLOCKER1 = "/wowlocker"
SlashCmdList.WOWLOCKER = function()
  if not me then return end
  local s = me.state
  print(("|cffffd100wow-locker|r: %d events recorded for %s. Level %d, %d/%d XP (+%d rested), %s, in %s."):format(
    #me.events, me.name, s.level or 0, s.xp or 0, s.xpMax or 0, s.rested or 0,
    GetCoinTextureString and GetCoinTextureString(s.money or 0) or tostring(s.money), s.zone or "?"))
  print(("|cffffd100wow-locker|r: %d quests completed%s."):format(
    s.questsCompleted and #s.questsCompleted or 0, s.run and (", in " .. s.run.name) or ""))
  print("|cffffd100wow-locker|r: data is written to disk on logout or /reload; the companion app uploads it.")
end
