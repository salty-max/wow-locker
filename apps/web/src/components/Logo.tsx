/**
 * The WoWLocker mark: the app icon itself (public/icon.svg), a lockbox drawn
 * like one of the game's item icons, in the bevel of a bag slot.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/icon.svg" width={size} height={size} alt="" aria-hidden className="shrink-0" draggable={false} />;
}
