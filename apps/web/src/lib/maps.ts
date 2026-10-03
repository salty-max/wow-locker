import maps from "@/data/maps.json";

/** Zone maps that exist (public/maps/<uiMapID>.webp, built by scripts/maps.py). */
const MAPS = maps as Record<string, string>;

export type MapMarker = { x: number; y: number; kind: "player" | "death" | "closeCall"; label: string };

export function hasMap(mapId: number | null | undefined): mapId is number {
  return mapId != null && String(mapId) in MAPS;
}
