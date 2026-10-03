-- wow-locker: records what the Battle.net API can't see.
--
-- Addons have no network access. Everything goes into the WowLockerDB
-- SavedVariables table, which the game writes to disk on logout, /reload or
-- disconnect; the WoWLocker companion app watches that file and uploads it.
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
--                    reputations = { … }, run = currentDungeonRun,
--                    resting,                              -- in an inn/city (rested rate)
--                    mail = { readAt, hasNew, letters = { … } },   -- when the mailbox was last open
--                    cooldowns = { { spellId|itemId, name, readyAt }, … } },
--       },
--     },
--   }
--
-- Event types: login, logout, gear, level, talent, respec, guild, death,
-- quest_accept, quest, close_call, dungeon_enter, dungeon_leave, loot, skill,
-- reputation.

-- Shared with Options.lua (the settings panel and the event log window).
local _, ns = ...
ns = ns or {}

local MAX_EVENTS = 5000 -- per character; the companion uploads long before this matters
local CLOSE_CALL_RESET = 0.5 -- …and has to be climbed back above before the next one
local SKILL_STEP = 25 -- skill milestones (weapon skills rise constantly)
-- Timed crafts worth a "ready" notification. Durations are read from the game
-- (they differ between Era and Anniversary); unknown ids are simply skipped.
local COOLDOWN_SPELLS = {
  18560, -- Mooncloth
  17187, -- Transmute: Arcanite
  11479, 11480, -- Transmute: Iron to Gold, Mithril to Truesilver
  17559, 17560, 17561, 17562, 17563, 17564, 17565, 17566, -- elemental transmutes
  26751, 31373, 36686, -- TBC: Primal Mooncloth, Spellcloth, Shadowcloth
  29688, 32765, 32766, -- TBC: Primal Might, Earthstorm / Skyfire Diamond
}
local COOLDOWN_ITEMS = { 15846 } -- Salt Shaker
local COOLDOWN_SPELL_SET = {}
for _, id in ipairs(COOLDOWN_SPELLS) do COOLDOWN_SPELL_SET[id] = true end

-- Item quality by link colour (loot is recorded from the "Loot quality from" setting up).
local QUALITY_BY_COLOR = { ["9d9d9d"] = 0, ["ffffff"] = 1, ["1eff00"] = 2, ["0070dd"] = 3, ["a335ee"] = 4, ["ff8000"] = 5 }

-- ── settings (WowLockerSettings: account-wide, never uploaded) ──────────────

local DEFAULTS = {
  loginMessage = true, -- one line in chat at login
  chatConfirm = false, -- print each event in chat as it's recorded
  closeCall = 0.15, -- health fraction that counts as a close call
  lootQuality = 2, -- 2 uncommon, 3 rare, 4 epic
  record = {
    gear = true, quests = true, loot = true, closeCalls = true, dungeons = true,
    skills = true, reputation = true, mail = true, cooldowns = true,
  },
}
-- Event type → its "record" toggle. Levels, deaths, talents, guild and
-- sessions are always recorded.
local CATEGORY = {
  gear = "gear", quest = "quests", quest_accept = "quests", loot = "loot",
  close_call = "closeCalls", dungeon_enter = "dungeons", dungeon_leave = "dungeons",
  skill = "skills", reputation = "reputation",
}

local settings
local function loadSettings()
  WowLockerSettings = WowLockerSettings or {}
  local s = WowLockerSettings
  for k, v in pairs(DEFAULTS) do
    if s[k] == nil then s[k] = type(v) == "table" and {} or v end
  end
  for k, v in pairs(DEFAULTS.record) do
    if s.record[k] == nil then s.record[k] = v end
  end
  settings = s
  return s
end

-- ── text (English, or French on a French client) ────────────────────────────

local FR = (GetLocale and GetLocale() or ""):sub(1, 2) == "fr"
local L = FR and {
  login = "Connexion (niveau %d)", logout = "Déconnexion",
  equipped = "Équipé %s (%s)", unequipped = "Retiré : %s",
  level = "Niveau %d atteint", played = " (temps de jeu %s)",
  talents = "Talents : %s", respec = "Réinitialisation des talents : %s",
  joined = "A rejoint <%s>", left = "A quitté <%s>",
  died = "Mort au niveau %d", by = " face à %s", where = " · %s",
  questAccepted = "Quête acceptée : %s", questDone = "Quête terminée : %s",
  closeCall = "Frôlé la mort : %d%% de vie",
  entered = "Entrée : %s", with = " avec %s",
  leftRun = "Sortie : %s après %s", deaths = ", %d mort(s)", calls = ", %d frôlement(s)",
  loot = "Butin : %s", received = "Reçu : %s", created = "Créé : %s",
  learned = "Appris : %s", skillUp = "%s : %d/%d", reputation = "%s auprès de %s",
  loaded = "%s · enregistre %s · %s pour le journal et les options",
} or {
  login = "Logged in (level %d)", logout = "Logged out",
  equipped = "Equipped %s (%s)", unequipped = "Unequipped: %s",
  level = "Reached level %d", played = " (played %s)",
  talents = "Talents: %s", respec = "Respec: %s",
  joined = "Joined <%s>", left = "Left <%s>",
  died = "Died at level %d", by = " to %s", where = " · %s",
  questAccepted = "Quest accepted: %s", questDone = "Quest completed: %s",
  closeCall = "Close call: %d%% health",
  entered = "Entered %s", with = " with %s",
  leftRun = "Left %s after %s", deaths = ", %d death(s)", calls = ", %d close call(s)",
  loot = "Looted %s", received = "Received %s", created = "Created %s",
  learned = "Learned %s", skillUp = "%s %d/%d", reputation = "%s with %s",
  loaded = "%s · recording %s · %s for the event log and options",
}
ns.L, ns.FR = L, FR

local PREFIX = "|cffffd100WoWLocker|r "
local SLOT_LABELS = {
  HEAD = "Head", NECK = "Neck", SHOULDER = "Shoulder", SHIRT = "Shirt", CHEST = "Chest", WAIST = "Waist",
  LEGS = "Legs", FEET = "Feet", WRIST = "Wrist", HANDS = "Hands", FINGER_1 = "Finger", FINGER_2 = "Finger",
  TRINKET_1 = "Trinket", TRINKET_2 = "Trinket", BACK = "Back", MAIN_HAND = "Main hand", OFF_HAND = "Off hand",
  RANGED = "Ranged", TABARD = "Tabard",
}

local function color(hex, text) return "|cff" .. hex .. text .. "|r" end

local function itemLink(id, name, hex)
  if not name then return "?" end
  if not id then return color(hex or "ffffff", "[" .. name .. "]") end
  return ("|cff%s|Hitem:%d|h[%s]|h|r"):format(hex or "ffffff", id, name)
end

local function duration(seconds)
  seconds = seconds or 0
  local d, h, m = math.floor(seconds / 86400), math.floor(seconds % 86400 / 3600), math.floor(seconds % 3600 / 60)
  if d > 0 then return ("%dd %dh"):format(d, h) end
  if h > 0 then return ("%dh %02dm"):format(h, m) end
  return ("%d min"):format(m)
end

local function coins(copper)
  if GetCoinTextureString then return GetCoinTextureString(copper) end
  return ("%dg %ds %dc"):format(math.floor(copper / 10000), math.floor(copper / 100) % 100, copper % 100)
end

local function trees(list)
  local out = {}
  for _, t in ipairs(list or {}) do out[#out + 1] = ("%s %d"):format(t.name or "?", t.points or 0) end
  return table.concat(out, " / ")
end

-- One recorded event as a chat-style line (the event log, chat confirmations).
local SYSTEM, DANGER, DEATH, SKILL, FACTION, MUTED = "ffff00", "ff8000", "ff2020", "5555ff", "8080ff", "a0a0a0"
function ns.formatEvent(e)
  local t = e.type
  if t == "login" then return color(MUTED, L.login:format(e.level or 0)) end
  if t == "logout" then return color(MUTED, L.logout) end
  if t == "gear" then
    local slot = SLOT_LABELS[e.slot] or e.slot or "?"
    if not e.name then return color(MUTED, L.unequipped:format(slot)) end
    return L.equipped:format(itemLink(e.itemId, e.name, e.color), slot)
  end
  if t == "level" then
    return color(SYSTEM, L.level:format(e.level or 0) .. (e.played and L.played:format(duration(e.played)) or ""))
  end
  if t == "talent" then return color(SYSTEM, L.talents:format(trees(e.trees))) end
  if t == "respec" then return color(SYSTEM, L.respec:format(trees(e.trees))) end
  if t == "guild" then
    return color("40ff40", e.to and L.joined:format(e.to) or L.left:format(e.from or "?"))
  end
  if t == "death" then
    local place = e.instance or e.zone
    return color(DEATH, L.died:format(e.level or 0) .. (e.killer and L.by:format(e.killer) or "")
      .. (e.spell and (" (" .. e.spell .. ")") or "") .. (place and L.where:format(place) or ""))
  end
  if t == "quest_accept" then return color(SYSTEM, L.questAccepted:format(e.title or ("#" .. tostring(e.questId)))) end
  if t == "quest" then
    local extra = {}
    if (e.xp or 0) > 0 then extra[#extra + 1] = ("+%d XP"):format(e.xp) end
    if (e.money or 0) > 0 then extra[#extra + 1] = coins(e.money) end
    return color(SYSTEM, L.questDone:format(e.title or ("#" .. tostring(e.questId))))
      .. (#extra > 0 and (" (" .. table.concat(extra, ", ") .. ")") or "")
  end
  if t == "close_call" then
    local place = e.instance or e.zone
    return color(DANGER, L.closeCall:format(e.pct or 0) .. (e.attacker and L.by:format(e.attacker) or "")
      .. (place and L.where:format(place) or ""))
  end
  if t == "dungeon_enter" then
    local group = e.group and #e.group > 0 and L.with:format(table.concat(e.group, ", ")) or ""
    return color(SYSTEM, L.entered:format(e.name or "?") .. group)
  end
  if t == "dungeon_leave" then
    return color(SYSTEM, L.leftRun:format(e.name or "?", duration(e.duration))
      .. ((e.deaths or 0) > 0 and L.deaths:format(e.deaths) or "")
      .. ((e.closeCalls or 0) > 0 and L.calls:format(e.closeCalls) or ""))
  end
  if t == "loot" then
    local how = e.how == "received" and L.received or e.how == "created" and L.created or L.loot
    return color("00aa00", how:format(itemLink(e.itemId, e.name, e.color) .. ((e.count or 1) > 1 and ("x" .. e.count) or "")))
  end
  if t == "skill" then
    return color(SKILL, e.learned and L.learned:format(e.name or "?") or L.skillUp:format(e.name or "?", e.rank or 0, e.max or 0))
  end
  if t == "reputation" then
    return color(FACTION, L.reputation:format(e.label or tostring(e.standing), e.faction or "?"))
  end
  return color(MUTED, t or "?")
end

local f = CreateFrame("Frame")
local me -- this character's record
local playerGUID
local ready = false

local lastAttacker -- { name, spell, environmental, t }: the last thing that damaged us
local lastTalents -- points per tree: a respec is points leaving a tree
local lastGuild
local guildKnown -- false while in a guild whose name hasn't loaded yet
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
  local category = CATEGORY[event.type]
  if category and settings and settings.record[category] == false then return end
  event.t = time()
  table.insert(me.events, event)
  if #me.events > MAX_EVENTS then table.remove(me.events, 1) end
  if settings and settings.chatConfirm and event.type ~= "login" and event.type ~= "logout" then
    print(PREFIX .. ns.formatEvent(event))
  end
  if ns.onRecord then ns.onRecord(event) end -- the event log window, when open
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
  s.resting = IsResting() and true or false
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

-- Lines under a collapsed header vanish from the API: merge, never forget.
local function merge(known, now)
  known = known or {}
  for name, v in pairs(now) do known[name] = v end
  return known
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
  -- Logged out inside for over 30 min (the instance has reset): that run ended then.
  local away = s.run and s.run.loggedOutAt and time() - s.run.loggedOutAt > 1800
  if s.run and (away or not dungeon or s.run.name ~= name) then
    local run = s.run
    record({
      type = "dungeon_leave",
      name = run.name,
      kind = run.kind,
      duration = (away and run.loggedOutAt or time()) - run.startedAt,
      deaths = run.deaths,
      closeCalls = run.closeCalls,
      group = run.group,
    })
    s.run = nil
  end
  -- Same instance after a /reload or a short disconnect: the run continues.
  if s.run then s.run.loggedOutAt = nil end
  if dungeon and not s.run then
    s.run = { name = name, kind = kind, startedAt = time(), deaths = 0, closeCalls = 0, group = groupNames() }
    record({ type = "dungeon_enter", name = name, kind = kind, level = UnitLevel("player"), group = s.run.group })
  end
end

-- ── mailbox ──────────────────────────────────────────────────────────────────

-- Readable only while a mailbox is open. On expiry, mail a player sent with
-- items goes back to them; returned mail and system mail are deleted.
local function readMailbox()
  if settings and settings.record.mail == false then
    me.state.mail = nil -- no expiry reminders either
    return
  end
  local letters = {}
  local now = time()
  for i = 1, GetInboxNumItems() do
    local _, _, sender, subject, money, cod, daysLeft, itemCount, wasRead, wasReturned, _, canReply = GetInboxHeaderInfo(i)
    local items = {}
    for a = 1, (ATTACHMENTS_MAX_RECEIVE or 12) do
      local name, itemId, _, count, quality = GetInboxItem(i, a)
      if name then items[#items + 1] = { name = name, itemId = itemId, count = count, quality = quality } end
    end
    letters[#letters + 1] = {
      sender = sender,
      subject = subject,
      money = money,
      cod = cod,
      read = wasRead,
      items = items,
      expiresAt = now + math.floor((daysLeft or 0) * 86400),
      onExpiry = (itemCount and itemCount > 0 and canReply and not wasReturned) and "returned" or "deleted",
    }
  end
  me.state.mail = { readAt = now, hasNew = HasNewMail() and true or false, letters = letters }
end

-- ── profession cooldowns ─────────────────────────────────────────────────────

-- GetSpellCooldown's start is on the GetTime() clock: convert to a real time.
local function readyAt(start, duration)
  if not start or start == 0 or not duration or duration == 0 then return time() end
  return time() + math.max(0, math.floor(start + duration - GetTime() + 0.5))
end

local function spellCooldown(id)
  if C_Spell and C_Spell.GetSpellCooldown then
    local cd = C_Spell.GetSpellCooldown(id)
    return cd and cd.startTime, cd and cd.duration
  end
  return GetSpellCooldown(id)
end

local function knows(id)
  if IsPlayerSpell then return IsPlayerSpell(id) end
  return IsSpellKnown and IsSpellKnown(id)
end

local function readCooldowns()
  if settings and settings.record.cooldowns == false then
    me.state.cooldowns = {}
    return
  end
  local list = {}
  for _, id in ipairs(COOLDOWN_SPELLS) do
    if knows(id) then
      list[#list + 1] = { spellId = id, name = (GetSpellInfo(id)), readyAt = readyAt(spellCooldown(id)) }
    end
  end
  for _, id in ipairs(COOLDOWN_ITEMS) do
    if GetItemCount(id) > 0 then
      list[#list + 1] = { itemId = id, name = (GetItemInfo(id)), readyAt = readyAt(GetItemCooldown(id)) }
    end
  end
  me.state.cooldowns = list
end

-- ── /played without spamming the chat ────────────────────────────────────────

local quietPlayed = false

local function restoreChatPlayed()
  if not quietPlayed then return end
  quietPlayed = false
  for i = 1, NUM_CHAT_WINDOWS do
    local cf = _G["ChatFrame" .. i]
    if cf then cf:RegisterEvent("TIME_PLAYED_MSG") end
  end
end

local function requestPlayedQuietly()
  quietPlayed = true
  for i = 1, NUM_CHAT_WINDOWS do
    local cf = _G["ChatFrame" .. i]
    if cf then cf:UnregisterEvent("TIME_PLAYED_MSG") end
  end
  RequestTimePlayed()
  C_Timer.After(10, restoreChatPlayed) -- throttled requests may never be answered
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

local function version()
  local get = (C_AddOns and C_AddOns.GetAddOnMetadata) or GetAddOnMetadata
  return get and get("WowLocker", "Version") or "?"
end

local function init()
  loadSettings()
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
  guildKnown = lastGuild ~= nil or not IsInGuild()
  -- Skill names persist across sessions: a skill under a header collapsed at
  -- login isn't "learned" the day the player expands it.
  me.knownSkills = me.knownSkills or {}
  lastSkills = merge(nil, readSkills())
  for name in pairs(lastSkills) do me.knownSkills[name] = true end
  lastStandings = merge(nil, readStandings())
  storeSkillsAndReps()
  learnQuestTitles()
  me.state.questsCompleted = completedQuests()
  if settings.record.mail ~= false then
    me.state.mail = me.state.mail or {}
    me.state.mail.hasNew = HasNewMail() and true or false
  else
    me.state.mail = nil
  end
  snapshot()
  record({ type = "login", level = me.state.level })
  requestPlayedQuietly()
  ready = true
  if settings.loginMessage then
    print(PREFIX .. L.loaded:format(color("a0a0a0", "v" .. version()), me.name, color("ffd100", "/wowlocker")))
  end
end

-- For Options.lua.
ns.version = version
ns.settings = function() return settings end
ns.defaults = DEFAULTS
ns.character = function() return me end

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
  local lost, changed = false, false
  for i, tree in ipairs(lastTalents) do
    if now[i] and now[i].points ~= tree.points then changed = true end
    if now[i] and now[i].points < tree.points then lost = true end
  end
  if not changed then return end -- a level-up granting an unspent point
  record({ type = lost and "respec" or "talent", trees = now })
  lastTalents = now
end

function handlers.PLAYER_GUILD_UPDATE()
  local guild = GetGuildInfo("player")
  -- At login the name arrives after PLAYER_LOGIN: that first answer is the
  -- baseline, not a change. Later, a nil name only counts once out of the guild.
  if not guildKnown then
    if guild then lastGuild, guildKnown = guild, true end
    return
  end
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
  elseif frac > 0 and frac < (settings and settings.closeCall or DEFAULTS.closeCall) then
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

-- Classic passes (questLogIndex, questId); newer clients just the id.
function handlers.QUEST_ACCEPTED(a, b)
  local questId, index = b or a, b and a or nil
  local title, level
  if index then
    local t, l, _, isHeader, _, _, _, id = GetQuestLogTitle(index)
    if not isHeader and (id == nil or id == questId) then title, level = t, l end
  end
  learnQuestTitles()
  record({ type = "quest_accept", questId = questId, title = title or questTitles[questId], level = level })
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
      local quality = QUALITY_BY_COLOR[color and color:lower()]
      if id and quality and quality >= (settings and settings.lootQuality or DEFAULTS.lootQuality) then
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
      if not me.knownSkills[name] and next(me.knownSkills) then -- never seen, and not the very first read
        record({ type = "skill", name = name, section = s.section, rank = s.rank, max = s.max, learned = true })
      end
      me.knownSkills[name] = true
    elseif math.floor(s.rank / SKILL_STEP) > math.floor(before.rank / SKILL_STEP) then
      record({ type = "skill", name = name, section = s.section, rank = s.rank, max = s.max })
    end
  end
  lastSkills = merge(lastSkills, now)
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
  lastStandings = merge(lastStandings, now)
  storeSkillsAndReps()
end

function handlers.PLAYER_ENTERING_WORLD()
  snapshot()
  checkInstance()
  readCooldowns()
end

handlers.MAIL_INBOX_UPDATE = readMailbox -- the mailbox is open (or its content changed)

function handlers.UPDATE_PENDING_MAIL()
  if me.state.mail then me.state.mail.hasNew = HasNewMail() and true or false end
end

function handlers.UNIT_SPELLCAST_SUCCEEDED(unit, _, spellId)
  if unit == "player" and COOLDOWN_SPELL_SET[spellId] then
    -- The cooldown starts a moment after the cast event.
    C_Timer.After(1, readCooldowns)
  end
end

handlers.PLAYER_UPDATE_RESTING = function() snapshot() end

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
  if me.state.run then me.state.run.loggedOutAt = time() end
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
  if event == "UNIT_HEALTH" or event == "UNIT_SPELLCAST_SUCCEEDED" then
    f:RegisterUnitEvent(event, "player") -- not every party member and target
  else
    f:RegisterEvent(event)
  end
end

-- /wowlocker: a quick look at what's recorded for this character.
-- /wowlocker: the event log window (Options.lua); "/wowlocker options" opens the settings.
SLASH_WOWLOCKER1 = "/wowlocker"
SlashCmdList.WOWLOCKER = function(msg)
  if not me then return end
  msg = (msg or ""):lower()
  if (msg == "options" or msg == "config") and ns.openOptions then return ns.openOptions() end
  if ns.toggleLog then return ns.toggleLog() end
  print(PREFIX .. ("%d events recorded for %s. Saved on logout or /reload, then uploaded by the companion."):format(#me.events, me.name))
end
