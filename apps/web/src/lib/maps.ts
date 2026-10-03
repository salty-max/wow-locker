import maps from "@/data/maps.json";

/** Zone maps that exist (public/maps/<uiMapID>.webp, built by scripts/maps.py). */
const MAPS = maps as Record<string, string>;

export type MapMarker = { x: number; y: number; kind: "player" | "death" | "closeCall"; label: string };

export function hasMap(mapId: number | null | undefined): mapId is number {
  return mapId != null && String(mapId) in MAPS;
}

const BY_NAME = new Map(Object.entries(MAPS).map(([id, name]) => [name.toLowerCase(), Number(id)]));

/**
 * The zone map for a place: by its map id, or else by the zone's name (uploads
 * from before the addon sent map ids, or a save that lost it). English names.
 */
export function mapFor(mapId: number | null | undefined, zone: string | null | undefined): number | null {
  if (hasMap(mapId)) return mapId;
  return (zone && BY_NAME.get(zone.toLowerCase())) || null;
}
