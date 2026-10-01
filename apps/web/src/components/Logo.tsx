/** The wow-locker mark: an iron-bound chest with a gold padlock. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="80 90 352 336" aria-hidden>
      <defs>
        <linearGradient id="lk-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5228" />
          <stop offset="1" stopColor="#4a2810" />
        </linearGradient>
        <linearGradient id="lk-iron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa3b2" />
          <stop offset="1" stopColor="#4b5261" />
        </linearGradient>
        <linearGradient id="lk-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f8b700" />
          <stop offset="1" stopColor="#a86f00" />
        </linearGradient>
      </defs>
      <path d="M96 236 V196 C96 130 160 104 256 104 C352 104 416 130 416 196 V236 Z" fill="url(#lk-wood)" stroke="#2a1608" strokeWidth="8" />
      <rect x="96" y="236" width="320" height="176" rx="14" fill="url(#lk-wood)" stroke="#2a1608" strokeWidth="8" />
      <rect x="88" y="224" width="336" height="26" rx="6" fill="url(#lk-iron)" />
      <path d="M136 112 C130 140 128 170 128 196 V404" stroke="url(#lk-iron)" strokeWidth="22" fill="none" />
      <path d="M376 112 C382 140 384 170 384 196 V404" stroke="url(#lk-iron)" strokeWidth="22" fill="none" />
      <path d="M224 252 V226 C224 204 288 204 288 226 V252" stroke="url(#lk-gold)" strokeWidth="16" fill="none" strokeLinecap="round" />
      <rect x="204" y="248" width="104" height="88" rx="16" fill="url(#lk-gold)" stroke="#6b4500" strokeWidth="5" />
      <circle cx="256" cy="284" r="12" fill="#3a2600" />
      <path d="M250 290 L262 290 L266 318 L246 318 Z" fill="#3a2600" />
    </svg>
  );
}
