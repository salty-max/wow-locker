import type { CharacterSummary } from "@wow-locker/shared";
import { Skull, Sprout } from "lucide-react";
import { useT } from "@/lib/i18n";
import { realmLabel } from "@/lib/wow";
import { cn } from "@/lib/utils";

export function StatusBadges({ c }: { c: CharacterSummary }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {c.isGhost && (
        <span className="inline-flex items-center gap-1 rounded border border-q-poor/60 bg-stone-3 px-1.5 py-px text-[10px] font-bold tracking-wider text-q-poor uppercase">
          <Skull className="size-3" /> {t.card.dead}
        </span>
      )}
      {c.isSelfFound && (
        <span className="inline-flex items-center gap-1 rounded border border-q-uncommon/40 bg-q-uncommon/10 px-1.5 py-px text-[10px] font-bold tracking-wider text-q-uncommon uppercase">
          <Sprout className="size-3" /> {t.card.selfFound}
        </span>
      )}
    </span>
  );
}

export function RealmTag({ c }: { c: Pick<CharacterSummary, "region" | "realmSlug" | "realmName" | "flavour" | "realmCategory"> }) {
  const label = realmLabel({ region: c.region, slug: c.realmSlug, flavour: c.flavour, category: c.realmCategory });
  return (
    <span className="text-xs text-ink-faint">
      {c.realmName} <span className="uppercase">{c.region}</span> ·{" "}
      <span className={cn(label === "Hardcore" && "font-semibold text-q-danger")}>{label}</span>
    </span>
  );
}

export function ClassName({ c, className }: { c: Pick<CharacterSummary, "name" | "classKey">; className?: string }) {
  return (
    <span className={cn("cc", className)} data-c={c.classKey ?? undefined}>
      {c.name}
    </span>
  );
}
