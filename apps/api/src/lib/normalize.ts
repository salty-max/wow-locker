import type { EquippedItem, Flavour, ItemTooltip, Stats, TalentGroup } from "@wow-locker/shared";
import type { RawEquipment, RawMedia, RawSpecializations, RawStatistics, RawSummary } from "@/lib/bnet";
import { classKeyOf, factionOf, qualityOf, SLOT_ORDER } from "@/lib/classic";

/** The character-row fields that come from the profile summary + media. */
export function fromSummary(s: RawSummary, media: RawMedia | null) {
  const asset = (k: string) => media?.assets?.find((a) => a.key === k)?.value ?? null;
  return {
    blizzardId: s.id,
    name: s.name,
    realmName: s.realm.name,
    level: s.level,
    experience: s.experience ?? 0,
    race: s.race.name,
    className: s.character_class.name,
    classKey: classKeyOf(s.character_class.id),
    gender: s.gender.name,
    faction: factionOf(s.faction.type),
    guild: s.guild?.name ?? null,
    isGhost: s.is_ghost === true,
    isSelfFound: s.is_self_found === true,
    itemLevel: s.equipped_item_level ?? s.average_item_level ?? null,
    lastLoginAt: s.last_login_timestamp ? new Date(s.last_login_timestamp) : null,
    avatarUrl: asset("avatar"),
    renderUrl: asset("main-raw") ?? asset("main") ?? asset("inset"),
  };
}

type RawItem = NonNullable<RawEquipment["equipped_items"]>[number];

function tooltipOf(i: RawItem): ItemTooltip {
  const w = i.weapon;
  const price = i.sell_price?.display_strings;
  return {
    binding: i.binding?.name ?? null,
    slot: i.inventory_type?.name ?? null,
    type: i.item_subclass?.name ?? null,
    armor: i.armor?.display?.display_string ?? null,
    weapon:
      w?.damage && w.attack_speed
        ? { damage: w.damage.display_string, speed: w.attack_speed.display_string, dps: w.dps?.display_string ?? "" }
        : null,
    stats: (i.stats ?? []).filter((x) => !x.is_negated).flatMap((x) => (x.display?.display_string ? [x.display.display_string] : [])),
    effects: (i.spells ?? []).flatMap((x) => (x.description ? [x.description] : [])),
    requirement: i.requirements?.level?.display_string ?? null,
    durability: i.durability?.display_string ?? null,
    sellPrice: price ? { gold: Number(price.gold) || 0, silver: Number(price.silver) || 0, copper: Number(price.copper) || 0 } : null,
  };
}

export function fromEquipment(e: RawEquipment, icons: Map<number, string | null>): EquippedItem[] {
  const items = (e.equipped_items ?? []).map((i) => ({
    slot: i.slot.type,
    slotName: i.slot.name,
    itemId: i.item.id,
    name: i.name,
    quality: qualityOf(i.quality.type),
    iconUrl: icons.get(i.item.id) ?? null,
    enchantments: (i.enchantments ?? []).map((x) => x.display_string),
    tooltip: tooltipOf(i),
  }));
  const rank = (s: string) => {
    const r = SLOT_ORDER.indexOf(s);
    return r < 0 ? SLOT_ORDER.length : r;
  };
  return items.sort((a, b) => rank(a.slot) - rank(b.slot));
}

export function fromSpecializations(s: RawSpecializations): TalentGroup[] {
  return (s.specialization_groups ?? []).map((g) => ({
    active: g.is_active,
    trees: (g.specializations ?? []).map((t) => ({
      name: t.specialization_name,
      points: t.spent_points,
      talents: (t.talents ?? []).map((x) => ({
        id: x.talent.id,
        rank: x.talent_rank ?? 1,
        name: x.spell_tooltip?.spell?.name ?? "",
        description: x.spell_tooltip?.description ?? "",
      })),
    })),
  }));
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as { effective?: number; value?: number };
    return o.effective ?? o.value ?? 0;
  }
  return 0;
}

export function fromStatistics(s: RawStatistics): Stats {
  const r1 = (n: number) => Math.round(n * 100) / 100;
  return {
    health: num(s.health),
    power: num(s.power),
    powerType: s.power_type?.name ?? "",
    strength: num(s.strength),
    agility: num(s.agility),
    stamina: num(s.stamina),
    intellect: num(s.intellect),
    spirit: num(s.spirit),
    armor: num(s.armor),
    attackPower: num(s.attack_power),
    spellPower: num(s.spell_power),
    meleeCrit: r1(num(s.melee_crit)),
    spellCrit: r1(num(s.spell_crit)),
    dodge: r1(num(s.dodge)),
  };
}

/** Points in the active talent group, e.g. "Holy 7 / 0 / 0". */
export function activeTrees(groups: TalentGroup[]) {
  return ((groups.find((g) => g.active) ?? groups[0])?.trees ?? []).map((t) => ({ name: t.name, points: t.points }));
}

export type Flavoured = { flavour: Flavour };
