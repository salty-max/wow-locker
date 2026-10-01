import { FLAVOURS, type Realm, type Region } from "@wow-locker/shared";
import { api } from "@/lib/bnet";
import { log } from "@/lib/log";

/** Blizzard-internal realms that leak into the search (e.g. "PROGWOW EU4 Web"). */
const INTERNAL = /progwow|\bweb\b/i;
const TTL_MS = 24 * 3600 * 1000;
const cache = new Map<Region, { at: number; realms: Realm[] }>();

/** Every Classic realm of a region, all flavours (one search request per flavour, cached a day). */
export async function listRealms(region: Region): Promise<Realm[]> {
  const hit = cache.get(region);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.realms;
  const realms: Realm[] = [];
  for (const flavour of FLAVOURS) {
    try {
      const r = await api.realmSearch(flavour, region);
      for (const { data } of r.results) {
        const name = data.name.en_GB ?? data.name.en_US ?? Object.values(data.name)[0];
        if (INTERNAL.test(name)) continue;
        realms.push({
          region,
          flavour,
          slug: data.slug,
          name,
          category: data.category.en_GB ?? data.category.en_US ?? "",
          type: data.type.name.en_GB ?? data.type.type,
        });
      }
    } catch (err) {
      log.warn("realms.failed", { region, flavour, err: String(err) });
    }
  }
  realms.sort((a, b) => a.name.localeCompare(b.name));
  if (realms.length) cache.set(region, { at: Date.now(), realms });
  return realms;
}

/** A realm's category ("Classic Era", "Seasonal"…), from the cached list. */
export async function realmCategory(region: Region, flavour: string, slug: string): Promise<string> {
  const realms = await listRealms(region);
  return realms.find((r) => r.flavour === flavour && r.slug === slug)?.category ?? "";
}
