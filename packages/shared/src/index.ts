/**
 * @wow-locker/shared — the API wire contract. Source of truth for every JSON
 * shape exchanged between apps/api and apps/web.
 */

export type Region = "eu" | "us";
export const REGIONS: Region[] = ["eu", "us"];

/**
 * Battle.net namespace family of a realm (verified live, 2026-10-01):
 *   classic1x  — Classic Era, Hardcore (incl. Anniversary Hardcore, e.g. Soulseeker), Season of Discovery
 *   classicann — TBC Anniversary (Thunderstrike, Spineshatter…)
 *   classic    — progression Classic (MoP Classic)
 */
export type Flavour = "classic1x" | "classicann" | "classic";
export const FLAVOURS: Flavour[] = ["classic1x", "classicann", "classic"];

/**
 * Hardcore realms. The API files them under plain "Classic Era", so we label
 * the ones we know (Era Hardcore 2023 + Anniversary Hardcore 2024).
 */
const HARDCORE_REALMS: Record<Region, string[]> = {
  eu: ["soulseeker", "stitches", "nekrosh"],
  us: ["doomhowl", "defias-pillager", "skull-rock"],
};
export const isHardcoreRealm = (r: { region: Region; slug: string }): boolean => HARDCORE_REALMS[r.region]?.includes(r.slug) ?? false;

export type ClassKey =
  | "warrior"
  | "paladin"
  | "hunter"
  | "rogue"
  | "priest"
  | "deathknight"
  | "shaman"
  | "mage"
  | "warlock"
  | "monk"
  | "druid"
  | "demonhunter"
  | "evoker";

export type Faction = "alliance" | "horde" | "neutral";

export type Quality = "poor" | "common" | "uncommon" | "rare" | "epic" | "legendary" | "artifact" | "heirloom";

export type Realm = {
  region: Region;
  flavour: Flavour;
  slug: string;
  name: string;
  category: string; // "Classic Era", "Anniversary", "Seasonal", "Active"…
  type: string; // "PvE", "PvP", "RP"…
};

export type CharacterStatus = "ok" | "not_found" | "error";

/** A roster card. */
export type CharacterSummary = {
  id: number;
  region: Region;
  flavour: Flavour;
  realmSlug: string;
  realmName: string;
  /** Realm category from Battle.net ("Classic Era", "Seasonal", "Anniversary"…). */
  realmCategory: string;
  name: string;
  level: number;
  experience: number;
  /** XP needed for the next level, when the flavour's table is known. */
  xpToNext: number | null;
  race: string;
  className: string;
  classKey: ClassKey | null;
  gender: string;
  faction: Faction;
  guild: string | null;
  isGhost: boolean; // Hardcore: dead
  isSelfFound: boolean;
  itemLevel: number | null;
  avatarUrl: string | null;
  renderUrl: string | null;
  lastLoginAt: string | null; // ISO
  deadAt: string | null; // ISO, first time we saw it as a ghost
  status: CharacterStatus;
  fetchedAt: string | null; // ISO
  /** Latest timeline event (ISO): the app toasts when it moves. */
  lastEventAt: string | null;
  /** Last companion upload of addon data (ISO). */
  addonSyncedAt: string | null;
  /** The addon's latest numbers, for the Today overview (null: no addon data). */
  today: TodayInfo | null;
  /** The logged-in viewer owns it (can share it). */
  mine: boolean;
  /** Its owner opened its private details to anyone. */
  shared: boolean;
  /** Bags, bank, mail, gold and position are hidden from this viewer. */
  restricted: boolean;
};

/** What the Today overview needs from a character's last addon save. */
export type TodayInfo = {
  savedAt: string | null; // ISO, last refresh in game
  xp: number | null;
  xpMax: number | null;
  rested: number | null;
  resting: boolean | null;
  money: number | null; // copper
  played: number | null; // seconds
  zone: string | null;
  bags: { used: number; total: number } | null;
  /** Letters still in the mailbox (expired ones dropped), the next to expire first. */
  mail: { letters: number; hasNew: boolean; nextExpiry: string | null; nextOnExpiry: "returned" | "deleted" | null } | null;
  cooldowns: { name: string | null; readyAt: string }[];
};

/** What the in-game item tooltip shows, mostly as Blizzard's own display text. */
export type ItemTooltip = {
  binding: string | null; // "Binds when picked up"
  slot: string | null; // "Two-Hand", "Chest"
  type: string | null; // "Mace", "Mail"
  armor: string | null; // "144 Armor"
  weapon: { damage: string; speed: string; dps: string } | null;
  stats: string[]; // "+4 Stamina"
  effects: string[]; // "Equip: …", "Use: …"
  requirement: string | null; // "Requires Level 13"
  durability: string | null; // "Durability 58 / 75"
  sellPrice: { gold: number; silver: number; copper: number } | null;
};

export type EquippedItem = {
  slot: string; // MAIN_HAND, HEAD…
  slotName: string; // "Main Hand"
  itemId: number;
  name: string;
  quality: Quality;
  iconUrl: string | null;
  enchantments: string[];
  /** Absent on snapshots taken before tooltips existed. */
  tooltip?: ItemTooltip;
};

/** A learned talent, as the profile reports it (description = current rank). */
export type LearnedTalent = { id: number; rank: number; name: string; description: string };
export type TalentTree = { name: string; points: number; talents?: LearnedTalent[] };
export type TalentGroup = { active: boolean; trees: TalentTree[] };

export type Stats = {
  health: number;
  power: number;
  powerType: string;
  strength: number;
  agility: number;
  stamina: number;
  intellect: number;
  spirit: number;
  armor: number;
  attackPower: number;
  spellPower: number;
  meleeCrit: number;
  spellCrit: number;
  dodge: number;
};

export type EventType =
  | "tracked"
  | "level"
  | "death"
  | "gear"
  | "respec"
  | "guild"
  | "selfFoundLost"
  | "missing"
  | "found"
  // from the in-game addon
  | "session"
  | "talent"
  | "quest"
  | "closeCall"
  | "dungeon"
  | "loot"
  | "skill"
  | "reputation"
  | "pet"
  // scheduled from addon data, fired while the game is closed
  | "reminder";

/** Every event type a device can choose to be notified about. */
export const NOTIFIABLE_EVENTS: EventType[] = [
  "level",
  "death",
  "closeCall",
  "dungeon",
  "reminder",
  "reputation",
  "guild",
  "respec",
  "gear",
  "quest",
  "loot",
  "skill",
  "pet",
  "session",
  "selfFoundLost",
  "missing",
];
/** Defaults: what matters, without a push for every quest or green item. */
export const DEFAULT_NOTIFY_EVENTS: EventType[] = [
  "level",
  "death",
  "closeCall",
  "dungeon",
  "reminder",
  "reputation",
  "guild",
  "respec",
  "pet",
  "selfFoundLost",
  "missing",
];

export type GearChange = { slot: string; slotName: string; from: string | null; to: string | null; quality: Quality | null };

export type ReminderKind = "mailExpiring" | "rested" | "cooldown";

export type EventData =
  | { type: "tracked"; level: number }
  | { type: "level"; from: number; to: number; /** /played (s) when reached, from the addon */ played?: number }
  | {
      type: "death";
      level: number;
      // from the addon
      killer?: string | null;
      spell?: string | null;
      environmental?: boolean;
      zone?: string | null;
      subZone?: string | null;
      x?: number | null;
      y?: number | null;
      /** The zone map the coordinates are on (uiMapID). */
      mapId?: number | null;
      instance?: string | null;
    }
  | { type: "gear"; changes: GearChange[] }
  | { type: "respec"; from: TalentTree[]; to: TalentTree[] }
  | { type: "guild"; from: string | null; to: string | null }
  | { type: "selfFoundLost" }
  /** Two checks in a row found no profile: deleted, renamed or transferred. */
  | { type: "missing" }
  /** A missing character answering again. */
  | { type: "found" }
  // ── addon ──
  | {
      type: "session";
      action: "login" | "logout";
      level: number;
      /** XP into the level and gold (copper) at that moment (addon 0.3.7+). */
      xp?: number | null;
      money?: number | null;
      /** Logouts that end a session (not a /reload): what the session brought. */
      recap?: SessionRecap;
    }
  | { type: "talent"; trees: TalentTree[] }
  | {
      type: "quest";
      /** Absent: completed (older uploads). Accepted ones have no xp / money. */
      action?: "accept" | "complete";
      questId: number;
      title: string | null;
      xp: number;
      money: number;
      level?: number | null;
    }
  | {
      type: "closeCall";
      pct: number;
      level: number;
      attacker: string | null;
      spell: string | null;
      zone: string | null;
      subZone: string | null;
      instance: string | null;
      mapId?: number | null;
      x?: number | null;
      y?: number | null;
    }
  | {
      type: "dungeon";
      action: "enter" | "leave";
      name: string;
      kind: string;
      group: string[];
      duration?: number;
      deaths?: number;
      closeCalls?: number;
    }
  | { type: "loot"; itemId: number; name: string; quality: Quality; count: number; how: "loot" | "received" | "created" }
  | { type: "skill"; name: string; section: string | null; rank: number; max: number; learned: boolean }
  | { type: "reputation"; faction: string; standing: number; label: string | null }
  | {
      type: "pet";
      /** new: tamed (or first summoned); level: gained a level; death: died */
      action: "new" | "level" | "death";
      name: string;
      family: string | null;
      level: number;
      zone?: string | null;
      mapId?: number | null;
      x?: number | null;
      y?: number | null;
    }
  // ── scheduled ──
  | {
      type: "reminder";
      kind: ReminderKind;
      /** mailExpiring: letters / items about to expire; cooldown: the craft's name */
      detail: string | null;
      count?: number;
      onExpiry?: "returned" | "deleted";
    };

/** What a play session brought: first login → last logout, /reloads merged. */
export type SessionRecap = {
  start: string; // ISO
  end: string; // ISO
  duration: number; // seconds
  levelFrom: number;
  levelTo: number;
  /** XP earned (null: an end without it, before addon 0.3.7). */
  xp: number | null;
  /** Gold won (negative: spent), copper (null: unknown). */
  money: number | null;
  quests: number;
  /** Rare and better loot. */
  loot: { itemId: number; name: string; quality: Quality; count: number }[];
  deaths: number;
  closeCalls: number;
  /** Lowest health reached in a close call (%). */
  lowest: number | null;
  dungeons: string[];
  skillUps: number;
  reputations: number;
};

/** Close calls and deaths, by what caused them and where. */
export type DangerStats = {
  closeCalls: number;
  deaths: number;
  petDeaths: number;
  /** Lowest health ever reached in a close call (%). */
  lowest: number | null;
  attackers: { name: string; closeCalls: number; deaths: number; lowest: number | null }[];
  zones: { name: string; closeCalls: number; deaths: number }[];
  dungeons: { name: string; runs: number; closeCalls: number; deaths: number }[];
};

export type EventSource = "api" | "addon" | "scheduled";
export type CharacterEvent = { id: number; characterId: number; at: string; source: EventSource; data: EventData };

/** One stack in a bag or the bank (quality: 0 poor … 5 legendary). */
export type BagItem = { slot: number; itemId: number; name: string; count: number; quality: number | null };
/** A bag (or the bank's own slots): its name, size and filled slots. */
export type Container = { bag: number; name: string | null; size: number; items: BagItem[] };

export type PetState = {
  name: string;
  family: string | null;
  level: number;
  active: boolean;
  /** A hunter pet (XP, happiness, loyalty, training points); false: a warlock demon. */
  hunter: boolean;
  /** The game's icon file id (resolved to an icon name by the web app). */
  icon: number | null;
  xp: number | null;
  xpMax: number | null;
  /** 1 unhappy, 2 content, 3 happy */
  happiness: number | null;
  loyalty: string | null;
  trainingPoints: number | null;
  trainingSpent: number | null;
  abilities: string[];
  updatedAt: string | null;
};
export type StabledPet = { slot: number; name: string; family: string | null; level: number; icon: number | null; loyalty: string | null };

/** What the addon knows that the API doesn't, as of the last upload. */
export type AddonState = {
  syncedAt: string; // ISO, last upload
  updatedAt: string | null; // ISO, last time the addon refreshed it in game
  xp: number | null;
  xpMax: number | null;
  rested: number | null;
  resting: boolean | null;
  money: number | null; // copper
  playedTotal: number | null; // seconds
  playedLevel: number | null;
  zone: string | null;
  subZone: string | null;
  x: number | null;
  y: number | null;
  hardcore: boolean | null;
  levelPlayed: Record<string, number>; // level → /played when reached
  questsCompleted: number;
  skills: { name: string; section: string | null; rank: number; max: number }[];
  reputations: { name: string; standing: number; value: number; max: number }[];
  mail: {
    readAt: string | null;
    hasNew: boolean;
    letters: {
      sender: string | null;
      subject: string | null;
      money: number;
      items: { name: string; itemId: number | null; count: number; quality: number | null }[];
      expiresAt: string;
      onExpiry: "returned" | "deleted";
    }[];
  } | null;
  cooldowns: { name: string | null; spellId?: number; itemId?: number; readyAt: string }[];
  /** Dungeon the character was in at the last upload. */
  run: { name: string; kind: string; startedAt: string } | null;
  /** The zone map the position is on (uiMapID). */
  mapId: number | null;
  /** The hunter's (or warlock's) pet: the active one, or the last one seen. */
  pet: PetState | null;
  /** Stabled pets, as of the last visit to a stable master. */
  stable: { at: string; pets: StabledPet[] } | null;
  /** Backpack + bags, as of the last save. */
  bags: Container[];
  /** The bank as of the last visit (only readable while it's open in game). */
  bank: { at: string; containers: Container[] } | null;
};

export type CharacterDetail = CharacterSummary & {
  equipment: EquippedItem[];
  talents: TalentGroup[];
  stats: Stats | null;
  events: CharacterEvent[];
  /** Null until the companion has uploaded addon data for this character. */
  addon: AddonState | null;
  /** Icon URL per item id, for the items in bags, bank and mail (null: none). */
  itemIcons: Record<string, string | null>;
  /** From every close call, death and dungeon run the addon recorded (null: no addon). */
  dangers: DangerStats | null;
};

/** GET /api/memorial?ids=… : the fallen of a roster, and what threatens them all. */
export type Memorial = {
  fallen: {
    character: CharacterSummary;
    /** The death as recorded (the addon's has killer and place). */
    death: CharacterEvent | null;
    /** What happened in the hour before, newest first. */
    lastMoments: CharacterEvent[];
    played: number | null;
    questsCompleted: number | null;
  }[];
  /** Across every character of the roster, living or not. */
  dangers: DangerStats;
};

/** GET /api/items?ids=…&q=… : an item across the given characters. */
export type ItemMatch = {
  characterId: number;
  itemId: number;
  name: string;
  quality: number | null;
  icon: string | null;
  bags: number;
  bank: number;
  mail: number;
  equipped: number;
};

// ── companion ────────────────────────────────────────────────────────────────

/** POST /api/companion/pair/start */
export type PairStart = { code: string; pollToken: string; url: string; expiresIn: number };
/** POST /api/companion/pair/poll */
export type PairPoll = { status: "pending" } | { status: "paired"; token: string; battletag: string | null; characters: number } | { status: "expired" };
/** POST /api/companion/upload — the addon's WowLockerDB, converted from Lua to JSON. */
export type UploadRequest = { format: number; characters: Record<string, unknown> };
export type UploadResult = {
  /** gone: deleted (Battle.net no longer has it): the companion leaves it out of its list. */
  characters: { guid: string; name: string; status: "synced" | "unknown" | "invalid" | "gone"; events: number; characterId?: number }[];
};

export type AddCharacterRequest = { region: Region; flavour: Flavour; realm: string; name: string };

/** A character found on the user's Battle.net account (import screen). */
export type AccountCharacter = {
  region: Region;
  flavour: Flavour;
  realmSlug: string;
  realmName: string;
  realmCategory: string;
  name: string;
  level: number;
  className: string;
  classKey: ClassKey | null;
  faction: Faction;
  /** From the character's own profile, filled in after the list (null = unknown yet). */
  isGhost: boolean | null;
  isSelfFound: boolean | null;
  /** Our id if this character is already tracked by the server. */
  trackedId: number | null;
};

export type AccountImport = {
  region: Region;
  /** The account's BattleTag (shown as the login status). */
  battletag: string | null;
  characters: AccountCharacter[];
  /** Flavours whose account endpoint did not answer (Blizzard gaps). */
  unavailable: Flavour[];
  /** True while the server is still reading each character's dead/alive status. */
  checking: boolean;
};

export type Lang = "en" | "fr";

/** GET /api/me: the logged-in account (null: a guest, the locker is per device). */
export type Me = {
  id: number;
  battletag: string | null;
  /** Regions logged in with (each proves that region's characters). */
  regions: Region[];
  roster: number[];
  /** Null until a device sent its own. */
  lang: Lang | null;
  events: EventType[] | null;
};

export type SubscribeRequest = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  deviceId: string;
  /** The characters this device tracks (its roster). */
  characterIds: number[];
  events: EventType[];
  lang: Lang;
  welcome?: boolean;
};
