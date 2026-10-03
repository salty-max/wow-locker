import type { Flavour, ItemTooltip, Region } from "@wow-locker/shared";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { itemTooltips } from "@/db/schema";
import { api, BnetError } from "@/lib/bnet";
import { previewTooltip } from "@/lib/normalize";

/**
 * An item's tooltip lines, from the cache or (once per item ever) Battle.net's
 * static item API. null: the API doesn't know the item.
 */
export async function itemTooltip(region: Region, flavour: Flavour, itemId: number): Promise<ItemTooltip | null> {
  const [row] = await db
    .select()
    .from(itemTooltips)
    .where(and(eq(itemTooltips.region, region), eq(itemTooltips.flavour, flavour), eq(itemTooltips.itemId, itemId)));
  if (row) return row.tooltip;
  let tooltip: ItemTooltip | null = null;
  try {
    const item = await api.item(flavour, region, itemId);
    tooltip = item.preview_item ? previewTooltip(item.preview_item) : null;
  } catch (err) {
    // A 404 is an answer (remembered); anything else is a blip (not cached).
    if (!(err instanceof BnetError && err.status === 404)) throw err;
  }
  await db.insert(itemTooltips).values({ region, flavour, itemId, tooltip }).onConflictDoNothing();
  return tooltip;
}
