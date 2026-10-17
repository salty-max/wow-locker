import { describe, expect, it } from "bun:test";
import { currentEquipment } from "./equipment";
import { parseAddonCharacter } from "./addon";
import session from "./__fixtures__/addon-session.json";

const [[guid, raw]] = Object.entries(session.characters);
const parsed = parseAddonCharacter(guid, raw)!;
const addon = { ...parsed.state, syncedAt: parsed.state.updatedAt! };
const apiGear = [{ ...addon.equipment![0], itemId: 100, name: "Old API robe" }];

describe("current equipment", () => {
  it("shows the addon loadout before there is an Armory profile", () => {
    expect(currentEquipment({ addon, equipment: [], lastLoginAt: null })).toEqual(addon.equipment!);
  });
  it("chooses the newer full snapshot rather than merging stale occupied slots", () => {
    expect(currentEquipment({ addon, equipment: apiGear, lastLoginAt: new Date(Date.parse(addon.updatedAt!) - 1000) })).toEqual(addon.equipment!);
    expect(currentEquipment({ addon, equipment: apiGear, lastLoginAt: new Date(Date.parse(addon.updatedAt!) + 1000) })).toEqual(apiGear);
  });
  it("allows an explicit empty loadout to clear old gear", () => {
    expect(currentEquipment({ addon: { ...addon, equipment: [] }, equipment: apiGear, lastLoginAt: null })).toEqual([]);
  });
  it("keeps the API equipment for old addons without a full snapshot", () => {
    expect(currentEquipment({ addon: { ...addon, equipment: undefined }, equipment: apiGear, lastLoginAt: null })).toEqual(apiGear);
  });
  it("keeps known item details for unchanged gear without reusing a replaced item's tooltip", () => {
    const known = { ...addon.equipment![0], enchantments: ["+5 Health"], iconUrl: "robe.jpg" };
    expect(currentEquipment({ addon, equipment: [known], lastLoginAt: null })[0]).toMatchObject({ enchantments: ["+5 Health"], iconUrl: "robe.jpg" });
    expect(currentEquipment({ addon, equipment: [{ ...known, name: "A different suffix" }], lastLoginAt: null })[0].enchantments).toEqual([]);
  });
});
