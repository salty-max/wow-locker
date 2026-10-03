-- wow-locker: the settings panel (Esc → Options → AddOns → WoWLocker) and the
-- event log window (/wowlocker). Everything recorded lives in WowLocker.lua;
-- this file only shows it and edits WowLockerSettings.

local _, ns = ...
local L = ns.FR and {
  subtitle = "Enregistre le parcours de vos personnages pour wow-locker.app.",
  chat = "Discussion",
  loginMessage = "Afficher un message à la connexion",
  chatConfirm = "Afficher chaque événement enregistré dans la discussion",
  record = "Enregistrer",
  always = "Les niveaux, morts, talents et changements de guilde sont toujours enregistrés.",
  gear = "Changements d'équipement", quests = "Quêtes (acceptées et terminées)", loot = "Butin",
  closeCalls = "Frôlements de mort", dungeons = "Donjons", skills = "Métiers et compétences",
  reputation = "Réputations", mail = "Courrier (rappels d'expiration)", cooldowns = "Recharges d'artisanat",
  bags = "Sacs et banque",
  threshold = "Frôlement de mort sous",
  lootFrom = "Butin à partir de",
  uncommon = "Inhabituel", rare = "Rare", epic = "Épique",
  openLog = "Ouvrir le journal",
  footer = "Le jeu enregistre ces données à la déconnexion ou avec /reload ; l'application compagnon les envoie à wow-locker.app.",
  log = "Journal",
  all = "Tout", combat = "Combat", questsTab = "Quêtes", gearTab = "Équipement", progress = "Progression",
  dungeonsTab = "Donjons", sessions = "Sessions",
  count = "%d événements · sauvegardés à la déconnexion ou avec /reload, puis envoyés par le compagnon",
  options = "Options",
  sync = "Sauvegarder et envoyer",
  empty = "Rien d'enregistré pour l'instant.",
  combatLocked = "Indisponible en combat.",
} or {
  subtitle = "Records your characters' journey for wow-locker.app.",
  chat = "Chat",
  loginMessage = "Show a message at login",
  chatConfirm = "Print each recorded event in chat",
  record = "Record",
  always = "Level-ups, deaths, talents and guild changes are always recorded.",
  gear = "Gear changes", quests = "Quests (accepted and completed)", loot = "Loot",
  closeCalls = "Close calls", dungeons = "Dungeon runs", skills = "Professions and skills",
  reputation = "Reputation", mail = "Mail (expiry reminders)", cooldowns = "Crafting cooldowns",
  bags = "Bags and bank",
  threshold = "Close call below",
  lootFrom = "Loot from",
  uncommon = "Uncommon", rare = "Rare", epic = "Epic",
  openLog = "Open event log",
  footer = "The game saves this data when you log out or /reload; the companion app uploads it to wow-locker.app.",
  log = "Event log",
  all = "All", combat = "Combat", questsTab = "Quests", gearTab = "Gear & loot", progress = "Progress",
  dungeonsTab = "Dungeons", sessions = "Sessions",
  count = "%d events · saved on logout or /reload, then uploaded by the companion",
  options = "Options",
  sync = "Save & upload now",
  empty = "Nothing recorded yet.",
  combatLocked = "Not available in combat.",
}

local GOLD = "|cffffd100"

-- A child region from a template (TitleText, Text…), when the template made one.
local function part(obj, key)
  local v = obj[key]
  return type(v) == "table" and v or nil
end

-- ── small widget helpers (templates differ between client versions) ───────────

local function newFrame(kind, name, parent, template)
  if template then
    local ok, frame = pcall(CreateFrame, kind, name, parent, template)
    if ok and frame then return frame end
  end
  return CreateFrame(kind, name, parent)
end

local function text(parent, font, value)
  local fs = parent:CreateFontString(nil, "ARTWORK", font or "GameFontHighlight")
  fs:SetJustifyH("LEFT")
  if value then fs:SetText(value) end
  return fs
end

local function checkbox(parent, label, get, set)
  local cb = newFrame("CheckButton", nil, parent, "UICheckButtonTemplate")
  cb:SetSize(26, 26)
  local fs = part(cb, "Text") or part(cb, "text")
  if not fs then
    fs = text(cb, "GameFontHighlight")
    fs:SetPoint("LEFT", cb, "RIGHT", 2, 1)
  end
  fs:SetText(label)
  cb:SetScript("OnClick", function(self) set(self:GetChecked() and true or false) end)
  cb.refresh = function() cb:SetChecked(get()) end
  return cb
end

local function button(parent, label, width, onClick)
  local b = newFrame("Button", nil, parent, "UIPanelButtonTemplate")
  b:SetSize(width or 120, 22)
  b:SetText(label)
  b:SetScript("OnClick", onClick)
  return b
end

-- A row of mutually exclusive choices, drawn as checkboxes.
local function choices(parent, options, get, set)
  local boxes, last = {}, nil
  for i, opt in ipairs(options) do
    local cb = checkbox(parent, opt.label, function() return get() == opt.value end, function()
      set(opt.value)
      for _, other in ipairs(boxes) do other.refresh() end
    end)
    if last then cb:SetPoint("LEFT", last, "RIGHT", (last.labelWidth or 60) + 14, 0) end
    local fs = part(cb, "Text") or part(cb, "text")
    cb.labelWidth = fs and fs:GetStringWidth() or 60
    boxes[i], last = cb, cb
  end
  boxes.refresh = function() for _, b in ipairs(boxes) do b.refresh() end end
  return boxes
end

-- ── the event log window ──────────────────────────────────────────────────────

local FILTERS = {
  { key = "all", label = L.all },
  { key = "combat", label = L.combat, types = { death = true, close_call = true } },
  { key = "quests", label = L.questsTab, types = { quest = true, quest_accept = true } },
  { key = "gear", label = L.gearTab, types = { gear = true, loot = true } },
  { key = "progress", label = L.progress, types = { level = true, talent = true, respec = true, skill = true, reputation = true, guild = true } },
  { key = "dungeons", label = L.dungeonsTab, types = { dungeon_enter = true, dungeon_leave = true } },
  { key = "sessions", label = L.sessions, types = { login = true, logout = true } },
}

local logFrame, logLines, logStatus, filterButtons
local currentFilter = FILTERS[1]

local function matches(event)
  return not currentFilter.types or currentFilter.types[event.type]
end

local function line(event)
  return "|cff808080" .. date("%d/%m %H:%M", event.t or 0) .. "|r  " .. ns.formatEvent(event)
end

local function fillLog()
  if not logFrame then return end
  local me = ns.character()
  logLines:Clear()
  local shown = 0
  for _, event in ipairs(me and me.events or {}) do
    if matches(event) then
      logLines:AddMessage(line(event))
      shown = shown + 1
    end
  end
  if shown == 0 then logLines:AddMessage("|cff808080" .. L.empty .. "|r") end
  logLines:ScrollToBottom()
  logStatus:SetText(L.count:format(me and #me.events or 0))
  for _, b in ipairs(filterButtons) do
    if b.filter == currentFilter then b:LockHighlight() else b:UnlockHighlight() end
  end
end

local function buildLog()
  local f = newFrame("Frame", "WowLockerLogFrame", UIParent, "BasicFrameTemplateWithInset")
  if not part(f, "TitleText") and f.SetBackdrop == nil and BackdropTemplateMixin then
    Mixin(f, BackdropTemplateMixin) -- no window template on this client: a plain dialog frame
  end
  if not part(f, "TitleText") and f.SetBackdrop then
    f:SetBackdrop({
      bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
      edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
      tile = true, tileSize = 32, edgeSize = 32,
      insets = { left = 11, right = 12, top = 12, bottom = 11 },
    })
  end
  f:SetSize(640, 440)
  f:SetPoint("CENTER")
  f:SetFrameStrata("DIALOG")
  f:SetMovable(true)
  f:SetClampedToScreen(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  f:Hide()
  table.insert(UISpecialFrames, "WowLockerLogFrame") -- Esc closes it

  local title = part(f, "TitleText") or text(f, "GameFontNormal")
  if not part(f, "TitleText") then title:SetPoint("TOP", 0, -6) end
  local me = ns.character()
  title:SetText("WoWLocker · " .. L.log .. (me and (" · " .. me.name) or ""))

  filterButtons = {}
  local prev
  for _, filter in ipairs(FILTERS) do
    local b = button(f, filter.label, 84, function()
      currentFilter = filter
      fillLog()
    end)
    b.filter = filter
    if prev then b:SetPoint("LEFT", prev, "RIGHT", 2, 0) else b:SetPoint("TOPLEFT", 12, -32) end
    filterButtons[#filterButtons + 1], prev = b, b
  end

  logLines = CreateFrame("ScrollingMessageFrame", nil, f)
  logLines:SetPoint("TOPLEFT", 14, -62)
  logLines:SetPoint("BOTTOMRIGHT", -14, 44)
  logLines:SetFontObject(ChatFontNormal)
  logLines:SetJustifyH("LEFT")
  logLines:SetFading(false)
  logLines:SetMaxLines(5000)
  logLines:SetInsertMode(SCROLLING_MESSAGE_FRAME_INSERT_MODE_BOTTOM or "BOTTOM")
  logLines:EnableMouseWheel(true)
  logLines:SetScript("OnMouseWheel", function(self, delta)
    if delta > 0 then
      if IsShiftKeyDown() then self:ScrollToTop() else self:ScrollUp() end
    else
      if IsShiftKeyDown() then self:ScrollToBottom() else self:ScrollDown() end
    end
  end)
  -- Item links: hover for the tooltip, click like in chat.
  logLines:SetHyperlinksEnabled(true)
  logLines:SetScript("OnHyperlinkClick", function(_, link, label, mouse) SetItemRef(link, label, mouse) end)
  logLines:SetScript("OnHyperlinkEnter", function(self, link)
    GameTooltip:SetOwner(self, "ANCHOR_CURSOR")
    GameTooltip:SetHyperlink(link)
    GameTooltip:Show()
  end)
  logLines:SetScript("OnHyperlinkLeave", function() GameTooltip:Hide() end)

  logStatus = text(f, "GameFontDisableSmall")
  logStatus:SetPoint("BOTTOMLEFT", 16, 18)
  logStatus:SetPoint("RIGHT", f, "RIGHT", -280, 0)

  local sync = button(f, L.sync, 150, function() ReloadUI() end)
  sync:SetPoint("BOTTOMRIGHT", -12, 12)
  local opts = button(f, L.options, 100, function() ns.openOptions() end)
  opts:SetPoint("RIGHT", sync, "LEFT", -4, 0)

  f:SetScript("OnShow", fillLog)
  logFrame = f
end

-- New events appear while the window is open.
ns.onRecord = function(event)
  if logFrame and logFrame:IsShown() and matches(event) then
    logLines:AddMessage(line(event))
    local me = ns.character()
    logStatus:SetText(L.count:format(me and #me.events or 0))
  end
end

ns.toggleLog = function()
  if not logFrame then buildLog() end
  if logFrame:IsShown() then logFrame:Hide() else logFrame:Show() end
end

-- ── the settings panel ────────────────────────────────────────────────────────

local panel = CreateFrame("Frame")
panel.name = "WoWLocker"
panel:Hide()

local RECORD_KEYS = { "gear", "quests", "loot", "closeCalls", "dungeons", "skills", "reputation", "mail", "cooldowns", "bags" }
local widgets = {}

local function refresh()
  for _, w in ipairs(widgets) do w.refresh() end
end

local function build()
  if panel.built then return end
  panel.built = true
  local s = ns.settings

  local title = text(panel, "GameFontNormalLarge", "WoWLocker")
  title:SetPoint("TOPLEFT", 16, -16)
  local ver = text(panel, "GameFontDisableSmall", "v" .. ns.version())
  ver:SetPoint("LEFT", title, "RIGHT", 8, 0)
  local sub = text(panel, "GameFontHighlightSmall", L.subtitle)
  sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -6)

  local function header(label, anchor, y)
    local h = text(panel, "GameFontNormal", label)
    h:SetPoint("TOPLEFT", anchor, "BOTTOMLEFT", 0, y or -18)
    return h
  end

  -- Chat
  local chat = header(L.chat, sub)
  local login = checkbox(panel, L.loginMessage, function() return s().loginMessage end, function(v) s().loginMessage = v end)
  login:SetPoint("TOPLEFT", chat, "BOTTOMLEFT", -4, -4)
  local confirm = checkbox(panel, L.chatConfirm, function() return s().chatConfirm end, function(v) s().chatConfirm = v end)
  confirm:SetPoint("TOPLEFT", login, "BOTTOMLEFT", 0, 2)
  widgets[#widgets + 1], widgets[#widgets + 2] = login, confirm

  -- What to record: two columns
  local rec = header(L.record, confirm, -14)
  rec:SetPoint("LEFT", chat, "LEFT")
  local col, last = {}, nil
  for i, key in ipairs(RECORD_KEYS) do
    local cb = checkbox(panel, L[key], function() return s().record[key] ~= false end, function(v) s().record[key] = v end)
    if i == 1 then
      cb:SetPoint("TOPLEFT", rec, "BOTTOMLEFT", -4, -4)
    elseif i == 6 then
      cb:SetPoint("TOPLEFT", col[1], "TOPLEFT", 260, 0)
    else
      cb:SetPoint("TOPLEFT", last, "BOTTOMLEFT", 0, 2)
    end
    col[i], last = cb, cb
    widgets[#widgets + 1] = cb
  end
  local always = text(panel, "GameFontDisableSmall", L.always)
  always:SetPoint("TOPLEFT", col[5], "BOTTOMLEFT", 4, -6)

  -- Close call threshold
  local th = header(L.threshold, always, -16)
  local thresholds = choices(panel, {
    { label = "10%", value = 0.10 }, { label = "15%", value = 0.15 },
    { label = "20%", value = 0.20 }, { label = "25%", value = 0.25 },
  }, function() return s().closeCall end, function(v) s().closeCall = v end)
  thresholds[1]:SetPoint("TOPLEFT", th, "BOTTOMLEFT", -4, -4)
  widgets[#widgets + 1] = thresholds

  -- Loot quality
  local lq = header(L.lootFrom, thresholds[1], -12)
  lq:SetPoint("LEFT", th, "LEFT")
  local qualities = choices(panel, {
    { label = "|cff1eff00" .. L.uncommon .. "|r", value = 2 },
    { label = "|cff0070dd" .. L.rare .. "|r", value = 3 },
    { label = "|cffa335ee" .. L.epic .. "|r", value = 4 },
  }, function() return s().lootQuality end, function(v) s().lootQuality = v end)
  qualities[1]:SetPoint("TOPLEFT", lq, "BOTTOMLEFT", -4, -4)
  widgets[#widgets + 1] = qualities

  local open = button(panel, L.openLog, 160, function() ns.toggleLog() end)
  open:SetPoint("TOPLEFT", qualities[1], "BOTTOMLEFT", 4, -18)

  local footer = text(panel, "GameFontDisableSmall", L.footer)
  footer:SetPoint("TOPLEFT", open, "BOTTOMLEFT", 0, -12)
  footer:SetWidth(560)
  footer:SetJustifyH("LEFT")
end

panel:SetScript("OnShow", function()
  build()
  refresh()
end)

local function reset()
  local s = ns.settings()
  for k, v in pairs(ns.defaults) do
    if type(v) == "table" then
      for rk, rv in pairs(v) do s.record[rk] = rv end
    else
      s[k] = v
    end
  end
  if panel.built then refresh() end
end

-- Both settings APIs: the newer one (Settings.*) and the older Interface Options.
panel.OnCommit, panel.OnRefresh = function() end, refresh
panel.OnDefault, panel.default = reset, reset
panel.okay, panel.cancel, panel.refresh = function() end, function() end, refresh

local category
if Settings and Settings.RegisterCanvasLayoutCategory then
  category = Settings.RegisterCanvasLayoutCategory(panel, "WoWLocker")
  Settings.RegisterAddOnCategory(category)
elseif InterfaceOptions_AddCategory then
  InterfaceOptions_AddCategory(panel)
end

ns.openOptions = function()
  if InCombatLockdown and InCombatLockdown() then
    print(GOLD .. "WoWLocker|r " .. L.combatLocked)
    return
  end
  if category and Settings and Settings.OpenToCategory then
    Settings.OpenToCategory(category:GetID())
  elseif InterfaceOptionsFrame_OpenToCategory then
    -- Called twice: the first call only opens the frame on some clients.
    InterfaceOptionsFrame_OpenToCategory(panel)
    InterfaceOptionsFrame_OpenToCategory(panel)
  end
end
