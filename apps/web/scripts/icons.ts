// The app's icons from WoWLocker's painted logo (the repository's
// assets/logo-1024.png, the addon's and the store pages' own): `bun run icons`.
// The installed app's (PWA, iOS home screen) whole, the system rounds them;
// the favicon and the header's mark rounded here; the Android status bar's
// badge a white chest silhouette. favicon.ico holds the same rounded renders
// (48, 32, 16) for crawlers and Vercel, which ask for it by name.
import { Resvg } from "@resvg/resvg-js";

const pub = new URL("../public/", import.meta.url);
const logo = Buffer.from(await Bun.file(new URL("../../../assets/logo-1024.png", import.meta.url)).arrayBuffer()).toString("base64");
const image = (size: number, inset = 0) =>
  `<image href="data:image/png;base64,${logo}" x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}" preserveAspectRatio="xMidYMid slice"/>`;

function render(svg: string, size: number) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}
async function png(svg: string, size: number, name: string) {
  await Bun.write(new URL(name, pub), render(svg, size));
}
const whole = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${image(size)}</svg>`;
// (rounded as the app icon is on a phone: a fifth of the side)
const rounded = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="r"><rect width="${size}" height="${size}" rx="${size * 0.2}"/></clipPath></defs><g clip-path="url(#r)">${image(size)}</g></svg>`;

await png(whole(512), 512, "pwa-512.png");
await png(whole(192), 192, "pwa-192.png");
await png(whole(180), 180, "apple-touch-icon.png");
await png(rounded(32), 32, "favicon-32.png");
await png(rounded(16), 16, "favicon-16.png");

// favicon.ico: an ICO is a 6-byte header, 16 bytes per image, then PNG frames.
const frames = [48, 32, 16].map((size) => ({ size, data: render(rounded(size), size) }));
const ico = Buffer.alloc(6 + 16 * frames.length);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(frames.length, 4);
let offset = ico.length;
frames.forEach(({ size, data }, i) => {
  const at = 6 + 16 * i;
  ico.writeUInt8(size, at);
  ico.writeUInt8(size, at + 1);
  ico.writeUInt16LE(1, at + 4);
  ico.writeUInt16LE(32, at + 6);
  ico.writeUInt32LE(data.length, at + 8);
  ico.writeUInt32LE(offset, at + 12);
  offset += data.length;
});
await Bun.write(new URL("favicon.ico", pub), Buffer.concat([ico, ...frames.map((f) => f.data)]));
await png(rounded(192), 192, "logo-192.png");

// Maskable: the logo's own night around it, the chest inside the 80% safe zone.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#030714"/>${image(512, 46)}</svg>`,
  512,
  "pwa-maskable-512.png",
);

// Android status-bar badge: a white chest silhouette on transparent.
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#fff">
    <path d="M96 236 V196 C96 130 160 104 256 104 C352 104 416 130 416 196 V236 Z"/>
    <rect x="96" y="250" width="320" height="162" rx="14"/>
  </svg>`,
  96,
  "badge-96.png",
);
console.log("icons written");
