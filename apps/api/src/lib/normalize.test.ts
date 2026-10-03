import { describe, expect, it } from "bun:test";
import summary from "./__fixtures__/sealinedion-summary.json";
import equipment from "./__fixtures__/sealinedion-equipment.json";
import specs from "./__fixtures__/sealinedion-specializations.json";
import stats from "./__fixtures__/sealinedion-statistics.json";
import media from "./__fixtures__/sealinedion-character-media.json";
import tbcSpecs from "./__fixtures__/tbc-specializations.json";
import previews from "./__fixtures__/item-previews.json";
import type { RawEquipment, RawSpecializations, RawStatistics, RawSummary } from "./bnet";
import { xpToNext } from "./classic";
import { activeTrees, fromEquipment, fromSpecializations, fromStatistics, fromSummary, previewTooltip, type RawPreviewItem } from "./normalize";

describe("normalize (real Hardcore character, Soulseeker)", () => {
  it("reads the summary, including the Hardcore fields", () => {
    const s = fromSummary(summary as unknown as RawSummary, media);
    expect(s).toMatchObject({
      name: "Sealinedion",
      level: 17,
      experience: 675,
      race: "Dwarf",
      className: "Paladin",
      classKey: "paladin",
      faction: "alliance",
      isGhost: false,
      isSelfFound: true,
    });
    expect(s.avatarUrl).toContain("avatar.jpg");
    expect(s.renderUrl).toContain("main-raw.png");
  });

  it("orders equipment like the paper doll and keeps enchants", () => {
    const items = fromEquipment(equipment as unknown as RawEquipment, new Map([[4564, "icon.jpg"]]));
    expect(items.map((i) => i.slot).slice(0, 3)).toEqual(["BACK", "CHEST", "SHIRT"]); // no helm/neck/shoulders yet
    const club = items.find((i) => i.slot === "MAIN_HAND")!;
    expect(club).toMatchObject({ name: "Spiked Club of the Boar", quality: "uncommon", iconUrl: "icon.jpg" });
    expect(club.enchantments).toEqual(["+2 Spirit", "+2 Strength"]);
    expect(club.tooltip).toMatchObject({
      binding: "Binds when equipped",
      slot: "Two-Hand",
      type: "Mace",
      weapon: { damage: "22 - 34 Damage", speed: "Speed 3.10", dps: "(9.0 damage per second)" },
      sellPrice: { gold: 0, silver: 6, copper: 10 },
    });
    expect(items.find((i) => i.slot === "CHEST")!.tooltip).toMatchObject({ armor: "144 Armor", stats: ["+4 Stamina"], durability: "Durability 58 / 75" });
  });

  it("summarises talent trees (Era and TBC)", () => {
    const groups = fromSpecializations(specs as RawSpecializations);
    expect(activeTrees(groups)).toEqual([{ name: "Holy", points: 7 }]);
    // Which talents, at which rank (talent ids match the game's Talent table).
    expect(groups[0].trees[0].talents?.find((t) => t.id === 1449)).toMatchObject({ name: "Divine Intellect", rank: 5 });
    const tbc = activeTrees(fromSpecializations(tbcSpecs as unknown as RawSpecializations));
    expect(tbc.reduce((n, t) => n + t.points, 0)).toBeGreaterThan(50); // a level-70 character
  });

  it("flattens statistics", () => {
    expect(fromStatistics(stats as unknown as RawStatistics)).toMatchObject({ health: 452, strength: 46, armor: 776, powerType: "Mana" });
  });

  it("knows Era XP only", () => {
    expect(xpToNext("classic1x", 17)).toBe(17700);
    expect(xpToNext("classic1x", 60)).toBeNull();
    expect(xpToNext("classicann", 17)).toBeNull();
  });
});

// Real answers of the static item API (classic1x, EU), for bag tooltips.
const item = (id: number) => (previews as Record<string, RawPreviewItem>)[id];

describe("previewTooltip", () => {
  it("reads gear like an equipped item", () => {
    const tip = previewTooltip(item(5195)); // Gold-flecked Gloves
    expect(tip.slot).toBe("Hands");
    expect(tip.armor).toMatch(/Armor/);
    expect(tip.binding).toMatch(/Binds/);
    expect(tip.durability).toMatch(/Durability/);
    expect(tip.requirement).toMatch(/Requires Level/);
    expect(tip.sellPrice).not.toBeNull();
  });

  it("keeps a consumable's Use: line and hides its subclass, like the game", () => {
    const tip = previewTooltip(item(858)); // Lesser Healing Potion
    expect(tip.effects.some((e) => e.startsWith("Use:"))).toBe(true);
    expect(tip.type).toBeNull();
    expect(tip.slot).toBeNull(); // no "Non-equippable" line
    expect(tip.armor).toBeNull();
  });

  it("handles a plain trade good", () => {
    const tip = previewTooltip(item(2589)); // Linen Cloth
    expect(tip).toMatchObject({ binding: null, armor: null, weapon: null, stats: [], effects: [] });
    expect(tip.sellPrice?.copper ?? 0).toBeGreaterThan(0);
  });
});
