import type { EquippedItem } from "@wow-locker/shared";
import { Money } from "@/components/Money";
import { useT } from "@/lib/i18n";

/** The in-game item tooltip, line for line (from Blizzard's own display text). */
export function ItemTooltip({ item }: { item: EquippedItem }) {
  const t = useT();
  const tip = item.tooltip;
  return (
    <div className="space-y-0.5">
      <p className="q text-[14px] font-semibold" data-q={item.quality}>
        {item.name}
      </p>
      {tip?.binding && <p>{tip.binding}</p>}
      {(tip?.slot || tip?.type) && (
        <p className="flex justify-between gap-6">
          <span>{tip?.slot}</span>
          <span>{tip?.type}</span>
        </p>
      )}
      {tip?.weapon && (
        <>
          <p className="flex justify-between gap-6">
            <span>{tip.weapon.damage}</span>
            <span>{tip.weapon.speed}</span>
          </p>
          <p>{tip.weapon.dps}</p>
        </>
      )}
      {tip?.armor && <p>{tip.armor}</p>}
      {tip?.stats.map((s) => (
        <p key={s}>{s}</p>
      ))}
      {/* Random-suffix stats ("of the Boar") and enchants come through here. */}
      {item.enchantments.map((e) => (
        <p key={e} className="text-q-uncommon">
          {e}
        </p>
      ))}
      {tip?.durability && <p>{tip.durability}</p>}
      {tip?.requirement && <p>{tip.requirement}</p>}
      {tip?.effects.map((e) => (
        <p key={e} className="text-q-uncommon">
          {e}
        </p>
      ))}
      {tip?.sellPrice && (tip.sellPrice.gold + tip.sellPrice.silver + tip.sellPrice.copper > 0) && (
        <p className="flex items-center gap-1.5 pt-0.5">
          {t.tooltip.sellPrice} <Money {...tip.sellPrice} />
        </p>
      )}
      {!tip && <p className="text-xs text-ink-faint">{t.tooltip.pending}</p>}
    </div>
  );
}
