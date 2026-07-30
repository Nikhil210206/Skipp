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

for (const { file, size, radius, inset } of ICONS) {
  const svg = logoSvg({ size, fg: INK, bg: ACCENT, radius, inset });
  const out = join(root, "public", file);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`wrote public/${file}  ${size}x${size}`);
}
