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

export type EventType = "tracked" | "level" | "death" | "gear" | "respec" | "guild" | "selfFoundLost" | "missing" | "found";
export const NOTIFIABLE_EVENTS: EventType[] = ["level", "death", "gear", "respec", "guild", "selfFoundLost", "missing"];

export type GearChange = { slot: string; slotName: string; from: string | null; to: string | null; quality: Quality | null };

export type EventData =
  | { type: "tracked"; level: number }
  | { type: "level"; from: number; to: number }
  | { type: "death"; level: number }
  | { type: "gear"; changes: GearChange[] }
  | { type: "respec"; from: TalentTree[]; to: TalentTree[] }
  | { type: "guild"; from: string | null; to: string | null }
  | { type: "selfFoundLost" }
  /** Two checks in a row found no profile: deleted, renamed or transferred. */
  | { type: "missing" }
  /** A missing character answering again. */
  | { type: "found" };

export type CharacterEvent = { id: number; characterId: number; at: string; data: EventData };

export type CharacterDetail = CharacterSummary & {
  equipment: EquippedItem[];
  talents: TalentGroup[];
  stats: Stats | null;
  events: CharacterEvent[];
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

export type SubscribeRequest = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  deviceId: string;
  /** The characters this device tracks (its roster). */
  characterIds: number[];
  events: EventType[];
  lang: Lang;
  welcome?: boolean;
};
