// Builds the Stone theme's wall texture from a photograph.
//
// WHY THIS EXISTS: the wall was first drawn procedurally, with layered CSS
// gradients and feTurbulence noise. That was rebuilt four times and never
// matched the reference, because procedural noise is not a photograph and no
// amount of tuning turns one into the other. The texture is now the actual
// image, and this script is what prepares it.
//
//   node scripts/make-wall.mjs <source-image> [left] [top] [width] [height]
//
// Defaults are the clean wall region of the original reference (no chair, no
// lamp cords, no floor).
//
// LICENSING: the source is a stock photograph. Whoever ships this needs a
// licence that covers redistribution inside an application.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [, , src, ...rest] = process.argv;
if (!src) {
  console.error("usage: node scripts/make-wall.mjs <source-image> [l t w h]");
  process.exit(1);
}
const [left = 520, top = 10, width = 660, height = 620] = rest.map(Number);

const OUT = resolve("public/textures/wall.webp");
/** The tile the browser repeats. Big enough that a phone never sees a full
 *  period, small enough to stay a reasonable download. */
const TILE = 820;
const crop = sharp(src).extract({ left, top, width, height });

// THE TILE IS DARKER AND CALMER THAN THE CROP'S RAW STATISTICS, deliberately.
//
// The crop measures mean 81.5, stdev 40.7. Matching those exactly was tried
// first and the app came out looking like bright grey grunge, for two reasons.
// The wall in the photograph only READS as dark because it sits next to a pale
// chair, a plant and a lit floor, and because the shot carries a vignette; at
// full screen with nothing to compare against, 81 is plainly mid grey. And the
// high pass that removes the lighting also removes the large calm dark
// passages, so all that survives is grain, which raises apparent contrast.
//
// So the target is the photograph's MOOD rather than its arithmetic: dark
// enough to be the room, quiet enough to put type on.
const TARGET_MEAN = 52;
const TARGET_STDEV = 20;
const target = { mean: TARGET_MEAN, stdev: TARGET_STDEV };

// FLATTEN THE LIGHTING FIRST. The photograph is lit from one side, so the crop
// carries a soft gradient. Tiled, that gradient repeats and the seams become
// obvious as regular blocks of light and shade, which is the single thing that
// makes a photographic tile look fake.
//
// So: subtract a heavily blurred copy of the crop from the crop itself, which
// removes everything at low frequency and keeps the plaster grain. Both halves
// are scaled by 0.5 before adding, because `add` clips at 255 and the naive
// version saturates to white.
//
//   0.5c + (127.5 - 0.5b)  ->  x2 - 128  ->  127 + (c - b)
//
// The result is the texture alone, centred on mid grey, with no lighting in
// it. The theme's own raking-light gradient supplies the light instead, which
// is what lets one fixed light run down a page of any height.
const highpass = await sharp(await crop.clone().png().toBuffer())
  .linear(0.5, 0)
  .composite([
    {
      input: await sharp(await crop.clone().png().toBuffer())
        .blur(60)
        .linear(-0.5, 127.5)
        .png()
        .toBuffer(),
      blend: "add",
    },
  ])
  .png()
  .toBuffer();

// ONE linear, computed from what the high pass actually produced.
//
// `sharp` does NOT compose chained `.linear()` calls: a second call replaces
// the first rather than applying on top of it. Two stacked corrections were
// tried and the tile came out at mean 91.6 instead of the intended 58, which
// is what forced measuring here rather than doing the arithmetic on paper.
const hpStats = await sharp(highpass).greyscale().stats();
const hp = hpStats.channels[0];
const a = target.stdev / hp.stdev;
const b = target.mean - a * hp.mean;
const flat = await sharp(highpass).linear(a, b).png().toBuffer();

// MIRROR TILE. Four quadrants, each a reflection of the first, so opposite
// edges are identical by construction and the repeat has no seam at all.
// Plaster is irregular enough that the symmetry does not read as a pattern,
// where a hard seam would read as a bug immediately.
const q = sharp(flat);
const [w, h] = [width, height];
const tiled = await sharp({
  create: {
    width: w * 2,
    height: h * 2,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
})
  .composite([
    { input: flat, left: 0, top: 0 },
    { input: await q.clone().flop().png().toBuffer(), left: w, top: 0 },
    { input: await q.clone().flip().png().toBuffer(), left: 0, top: h },
    { input: await q.clone().flip().flop().png().toBuffer(), left: w, top: h },
  ])
  .png()
  .toBuffer();

await mkdir(dirname(OUT), { recursive: true });
const info = await sharp(tiled)
  .resize(TILE, TILE, { fit: "fill" })
  .webp({ quality: 62, effort: 6 })
  .toFile(OUT);

console.log(
  `wall.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`,
);
