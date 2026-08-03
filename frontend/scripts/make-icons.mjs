// Draws the PWA icons from the canonical mark in src/lib/logo.ts.
//
// Run with:  node scripts/make-icons.mjs
//
// The geometry is imported, never copied, so the app icon and the mark on
// screen can never drift apart. jiti is what lets a plain node script read the
// TypeScript module.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { logoSvg } = jiti(join(root, "src/lib/logo.ts"));

// The brand: the mark knocked out of the accent. One colour, flat, no gradient.
const ACCENT = "#f2661c";
const INK = "#0a0a0c";

const ICONS = [
  // Rounded tile, for anywhere the platform shows the icon as supplied.
  { file: "icon-192.png", size: 192, radius: 7, inset: 5 },
  { file: "icon-512.png", size: 512, radius: 7, inset: 5 },
  // Full bleed, because the platform applies its own mask. The mark is pulled
  // further in so a circular crop cannot cut the blades.
  { file: "icon-maskable-512.png", size: 512, radius: 0, inset: 8 },
  { file: "apple-icon.png", size: 180, radius: 0, inset: 6 },
];

mkdirSync(join(root, "public"), { recursive: true });

/**
 * Wrap a PNG in an ICO container.
 *
 * An .ico is a 6 byte header, one 16 byte directory entry per image, then the
 * image data, and since Vista that data is allowed to be a PNG as-is. So the
 * whole format is a short prefix around bytes sharp already produced, which
 * beats taking a dependency for it.
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  // 0 in the width/height byte means 256, which is why 256 is written as 0.
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // offset to the data

  return Buffer.concat([header, entry, png]);
}

for (const { file, size, radius, inset } of ICONS) {
  const svg = logoSvg({ size, fg: INK, bg: ACCENT, radius, inset });
  const out = join(root, "public", file);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`wrote public/${file}  ${size}x${size}`);
}

// The browser tab. Next's App Router serves `src/app/favicon.ico` at
// /favicon.ico automatically, and it wins the tab over anything named in
// `metadata.icons`, so the create-next-app default sitting there was the icon
// everybody actually saw. 48px because a tab renders at 16 to 32 and a clean
// downscale beats a blurry upscale.
const FAVICON = 48;
const faviconPng = await sharp(
  Buffer.from(logoSvg({ size: FAVICON, fg: INK, bg: ACCENT, radius: 7, inset: 5 })),
)
  .png()
  .toBuffer();
writeFileSync(join(root, "src/app/favicon.ico"), pngToIco(faviconPng, FAVICON));
console.log(`wrote src/app/favicon.ico  ${FAVICON}x${FAVICON}`);
