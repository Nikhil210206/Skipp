// Builds the Paper theme's stock texture.
//
//   node scripts/make-paper.mjs
//
// WHY THIS ONE IS SYNTHESISED AND THE WALL IS NOT. `make-wall.mjs` opens with
// the lesson that procedural noise cannot become a specific photograph, and
// that stands. It does not apply here: there is no reference photograph to
// match, and paper grain genuinely IS a noise field (randomly laid fibre)
// rather than a particular object. Synthesising it also means no stock licence
// to worry about, which the wall still has hanging over it.
//
// THE HARD PART IS RESTRAINT, NOT DETAIL. Stone needed RANGE, roughly #232322
// to #6e6e68, because a dark ground swallows texture. A light ground does the
// opposite: it shows everything, and grain loud enough to notice on charcoal
// reads as dirt or as JPEG rot on a white sheet. The whole tile lives inside
// about +/-7 code values.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const OUT = resolve("public/textures/paper.webp");
const TILE = 512;

/* A tiny deterministic PRNG, so re-running this produces the same sheet rather
   than a different one every deploy. */
let seed = 0x5ee0;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const idx = (x, y) => y * TILE + x;
const field = new Float32Array(TILE * TILE);

/* 1. THE MOTTLE: how evenly the pulp settled. Value noise on a wrapped lattice,
      which is what makes the tile seamless: sampling the lattice modulo its own
      size means the right edge interpolates back into the left. */
function mottle(cells, amp) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
  const step = TILE / cells;
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < TILE; y++) {
    const gy = y / step, y0 = Math.floor(gy) % cells, y1 = (y0 + 1) % cells, fy = smooth(gy - Math.floor(gy));
    for (let x = 0; x < TILE; x++) {
      const gx = x / step, x0 = Math.floor(gx) % cells, x1 = (x0 + 1) % cells, fx = smooth(gx - Math.floor(gx));
      const a = g[y0 * cells + x0] * (1 - fx) + g[y0 * cells + x1] * fx;
      const b = g[y1 * cells + x0] * (1 - fx) + g[y1 * cells + x1] * fx;
      field[idx(x, y)] += (a * (1 - fy) + b * fy) * amp;
    }
  }
}
/* Two scales, because a sheet varies at the size of the mould as well as at the
   size of a fibre. One scale alone reads as television static. */
/* The coarse scale is kept DELIBERATELY WEAK. At 0.42 it produced a visible
   soft blotch across the sheet, which does not read as paper at all, it reads
   as uneven lighting, and this app already has a theme where the light is the
   point. Paper's variation belongs at fibre scale. */
mottle(6, 0.16);
mottle(20, 0.30);
mottle(52, 0.30);

/* 2. THE FIBRES. Short strands laid at random angles, drawn with wraparound so
      one crossing an edge continues on the far side. This is the part that says
      "paper" rather than "noise": grain alone is a texture, fibres are a
      material. */
for (let i = 0; i < 5200; i++) {
  const a = rnd() * Math.PI, len = 4 + rnd() * 16, v = (rnd() * 2 - 1) * 0.62;
  let x = rnd() * TILE, y = rnd() * TILE;
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let s = 0; s < len; s++) {
    field[idx((Math.round(x) % TILE + TILE) % TILE, (Math.round(y) % TILE + TILE) % TILE)] += v;
    x += dx; y += dy;
  }
}

/* 3. THE GRAIN. Per-pixel, and it tiles for free: independent samples have no
      correlation to break at an edge. */
for (let i = 0; i < field.length; i++) field[i] += (rnd() + rnd() + rnd() - 1.5) * 0.55;

/* Normalise to a known range, then spend the whole budget deliberately. */
let lo = Infinity, hi = -Infinity;
for (const v of field) { if (v < lo) lo = v; if (v > hi) hi = v; }
const mid = (lo + hi) / 2, half = (hi - lo) / 2;

/* A GREYSCALE TILE MULTIPLIED INTO THE PAGE COLOUR, not an RGBA overlay.
   The obvious build is RGBA with the deviation in the alpha channel, and it was
   built that way first: it came out 243KB, more than twice the wall, which is a
   whole photograph. WebP encodes an alpha channel LOSSLESSLY whatever
   `alphaQuality` says (measured: 70 and 82 produced byte-identical files), and
   per-pixel grain is the least compressible thing there is. One lossy grey
   channel carries the same information for a fraction of the bytes.

   Multiply only darkens, and that is the right one-way door for this material:
   paper is subtractive, a clump of fibre blocks light rather than emitting any,
   so a sheet has specks in it and no glints. `--color-ink-0` still owns the
   white; this only ever takes a little away from it. */
const grey = new Float64Array(TILE * TILE);
/* Full-scale darkening, in code values off white. The curve is deliberately
   NOT linear: raised to a power, most of the sheet sits within a value or two
   of white and only the fibre clumps dip. A linear map darkens every pixel by
   half the depth, which is not texture, it is just a duller page. */
const DEPTH = 36, CURVE = 1.45;
for (let i = 0; i < field.length; i++) {
  const v = Math.max(-1, Math.min(1, (field[i] - mid) / half));
  grey[i] = 255 - DEPTH * Math.pow((1 - v) / 2, CURVE);
}
/* NORMALISE THE MEAN, or the texture is a tone change wearing a texture's
   clothes. The curve alone left the average at 240, so multiplying it into the
   page darkened Paper by 5.7% overall: the sheet came out visibly duller than
   the colour the token names, which is a different complaint from the one this
   is meant to answer. Shifting the whole tile up to a known mean keeps the
   fibre depth and hands the page colour back. */
const TARGET_MEAN = 249.5;
let sum = 0; for (const v of grey) sum += v;
const shift = TARGET_MEAN - sum / grey.length;
for (let i = 0; i < grey.length; i++) grey[i] = Math.max(0, Math.min(255, Math.round(grey[i] + shift)));

await mkdir(dirname(OUT), { recursive: true });
await sharp(Buffer.from(Uint8Array.from(grey)), { raw: { width: TILE, height: TILE, channels: 1 } })
  .webp({ quality: 88, effort: 6 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
const st = await sharp(OUT).stats();
console.log(`wrote ${OUT}  ${meta.width}x${meta.height}  channels=${meta.channels}`);
console.log(`  tone: min ${st.channels[0].min}  max ${st.channels[0].max}  mean ${st.channels[0].mean.toFixed(1)}  stdev ${st.channels[0].stdev.toFixed(2)}`);
