import type { Flavour, Region } from "@wow-locker/shared";

/**
 * Hardcore realms. The API files them under plain "Classic Era", so the UI
 * labels the ones we know (Era Hardcore 2023 + Anniversary Hardcore 2024).
 */
const HARDCORE: Record<string, string[]> = {
  eu: ["soulseeker", "stitches", "nekrosh"],
  us: ["doomhowl", "defias-pillager", "skull-rock"],
};

export function isHardcoreRealm(r: { region: Region; slug: string }): boolean {
  return HARDCORE[r.region]?.includes(r.slug) ?? false;
}

/** The game version a realm belongs to, as players name them. */
export type Version = "hardcore" | "era" | "sod" | "anniversary" | "mop";
export const VERSIONS: Version[] = ["hardcore", "era", "sod", "anniversary", "mop"];

export const VERSION_LABEL: Record<Version, string> = {
  hardcore: "Hardcore",
  era: "Classic Era",
  sod: "Season of Discovery",
  anniversary: "TBC Anniversary",
  mop: "MoP Classic",
};

export function versionOf(r: { region: Region; slug: string; flavour: Flavour; category: string }): Version {
  if (isHardcoreRealm(r)) return "hardcore";
  if (r.flavour === "classicann") return "anniversary";
  if (r.flavour === "classic") return "mop";
  if (r.category === "Seasonal") return "sod";
  return "era";
}

/** Short label of a realm's game version, for the picker and the cards. */
export const realmLabel = (r: { region: Region; slug: string; flavour: Flavour; category: string }) => VERSION_LABEL[versionOf(r)];

export const flavourLabel: Record<Flavour, string> = {
  classic1x: "Classic Era",
  classicann: "TBC Anniversary",
  classic: "MoP Classic",
};
