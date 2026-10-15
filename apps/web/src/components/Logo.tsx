/**
 * The WoWLocker mark: the painted chest, the app icon itself (public/logo-192.png,
 * rounded, from the repository's assets/logo-1024.png: scripts/icons.ts).
 */
export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/logo-192.png" width={size} height={size} alt="" aria-hidden className="shrink-0" draggable={false} />;
}
