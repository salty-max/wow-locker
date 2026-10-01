import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Blizzard's character render is a 1600×1200 canvas with the character small
 * in the middle: scale it ×1.6 and crop to the body, with air above and below
 * whatever the race's height. The parent sets the size.
 *
 * Blizzard only renders recently played characters; for the others the API
 * gives just the portrait, so we show that, framed, with the reason.
 */
export function CharacterRender({ url, avatarUrl, className }: { url: string | null; avatarUrl?: string | null; className?: string }) {
  const t = useT();
  if (!url) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 px-4 text-center", className)}>
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            className="size-28 rounded-full border-4 border-[#a8862f] object-cover shadow-[0_0_0_1px_#000,0_6px_16px_rgb(0_0_0/0.7)]"
          />
        )}
        <p className="max-w-56 text-xs text-ink-faint">{t.character.noRender}</p>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={url}
        alt=""
        className="absolute top-[-40%] left-1/2 h-[160%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_8px_12px_rgb(0_0_0/0.7)]"
      />
    </div>
  );
}
