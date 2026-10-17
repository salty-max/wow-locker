import type { EquippedItem } from "@wow-locker/shared";
import type { CharacterRow } from "@/db/schema";

/** Use a complete in-game snapshot when the Armory is missing or older. */
export function currentEquipment(c: Pick<CharacterRow, "addon" | "equipment" | "lastLoginAt">): EquippedItem[] {
  const a = c.addon;
  if (!a?.equipment) return c.equipment;
  if (!c.lastLoginAt || (a.updatedAt && Date.parse(a.updatedAt) >= c.lastLoginAt.getTime())) {
    return a.equipment.map((item) => {
      const known = c.equipment.find((old) => old.slot === item.slot && old.itemId === item.itemId && old.name === item.name);
      return known ? { ...item, tooltip: known.tooltip, enchantments: known.enchantments, iconUrl: known.iconUrl } : item;
    });
  }
  return c.equipment;
}
