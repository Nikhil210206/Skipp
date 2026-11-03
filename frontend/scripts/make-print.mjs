// Builds Zine's printed objects: the keys on Home, the matchbox on Attendance,
// the strand of barbed wire that draws the 75% line, and the ink grain.
//
//   node scripts/make-print.mjs
//
// EACH OUTPUT IS A MASK, NOT A PICTURE. The PNGs are black with the ink in the
// alpha channel, and the theme paints them through `mask-image` with its own
// tokens, the same device the hand-drawn kit uses. So one file prints in the
// blue drum, in the red drum when something is short, and in any later ink,
// without a second copy of the image.
//
// PHOTOGRAPHS WIN OVER DRAWINGS. Drop a photo into `scripts/print-src/` named
// after an object (`keys.jpg`, `matchbox-full.jpg`, `matchbox-low.jpg`,
// `matchbox-empty.jpg`) and it is used instead of the drawing below. Shoot the
// object on a plain white sheet in soft daylight, filling most of the frame.
// No cut out is needed, and that is the point of a photocopy: the sheet is
// the brightest thing in the shot, so it prints no ink at all, and the object
// prints in proportion to how dark it is. A hard shadow prints as grey speckle,
// exactly as it would on a real copier, which is why the light should be soft.
//
// The drawings are stand-ins until then. This file's sibling `make-wall.mjs`
// records why: procedural shapes can only approximate a photograph, so the
// moment there is a real object to shoot, shoot it.
//
// The wire is always drawn, never photographed, because its knot IS data: it
// has to sit at exactly 75% of the width, under the same tick every meter in
// the app shares.

import sharp from "sharp";
import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve("public/print");
const SRC = resolve("scripts/print-src");

/* A tiny deterministic PRNG, so re-running this prints the same sheet rather
   than a different grain every deploy. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blur(src, W, H, sigma, wrap = false) {
  const r = Math.ceil(sigma * 3);
  const k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const ix = (x) => (wrap ? ((x % W) + W) % W : Math.min(W - 1, Math.max(0, x)));
  const iy = (y) => (wrap ? ((y % H) + H) % H : Math.min(H - 1, Math.max(0, y)));
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += src[y * W + ix(x + i)] * k[i + r];
      tmp[y * W + x] = a;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += tmp[iy(y + i) * W + x] * k[i + r];
      out[y * W + x] = a;
    }
  return out;
}

function rankUniform(a) {
  const n = a.length;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((p, q) => a[p] - a[q]);
  const out = new Float32Array(n);
  for (let r = 0; r < n; r++) out[idx[r]] = (r + 0.5) / n;
  return out;
}

/* THE GRAIN. White noise, blurred a little, then flattened back to an even
   spread of thresholds. The blur is what makes it a photocopy rather than a
   screen: neighbouring pixels share a threshold, so ink lands in clumps of two
   or three pixels, the way toner does, instead of as single-pixel static. */
function clumpField(W, H, seed, sigma, wrap = false) {
  const r = rng(seed);
  const n = new Float32Array(W * H);
  for (let i = 0; i < n.length; i++) n[i] = r();
  return rankUniform(blur(n, W, H, sigma, wrap));
}

/* Value noise on a wrapped lattice, summed over scales, roughly in [-1, 1].
   The surface texture of the object, and the uneven ink of the drum. */
function fbm(W, H, seed, scales) {
  const f = new Float32Array(W * H);
  const r = rng(seed);
  const sm = (t) => t * t * (3 - 2 * t);
  for (const [cells, amp] of scales) {
    const cx = Math.max(2, cells);
    const cy = Math.max(2, Math.round((cells * H) / W));
    const g = new Float32Array(cx * cy);
    for (let i = 0; i < g.length; i++) g[i] = r() * 2 - 1;
    for (let y = 0; y < H; y++) {
      const gy = (y / H) * cy, y0 = Math.floor(gy) % cy, y1 = (y0 + 1) % cy, fy = sm(gy - Math.floor(gy));
      for (let x = 0; x < W; x++) {
        const gx = (x / W) * cx, x0 = Math.floor(gx) % cx, x1 = (x0 + 1) % cx, fx = sm(gx - Math.floor(gx));
        const a = g[y0 * cx + x0] * (1 - fx) + g[y0 * cx + x1] * fx;
        const b = g[y1 * cx + x0] * (1 - fx) + g[y1 * cx + x1] * fx;
        f[y * W + x] += (a * (1 - fy) + b * fy) * amp;
      }
    }
  }
  return f;
}

/** How much ink each pixel of a drawing wants: dark is more, outside is none. */
async function coverageFromSvg(svg) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const cov = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const a = data[i * 4 + 3] / 255;
    const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    cov[i] = a < 0.02 ? -1 : (1 - lum) * Math.min(1, a * 1.15);
  }
  return { cov, W, H };
}

/**
 * The same from a photograph shot on a white sheet.
 *
 * The sheet's white is read from the photo's OWN border, before it is fitted:
 * fitting pads the frame, and a first version padded with pure white and then
 * read its border, so the real sheet (a phone exposes paper a few levels below
 * white) came out grey and printed as speckle across the whole background.
 * The padding is the measured sheet colour for the same reason.
 *
 * The darkest tone comes from the whole shot, so the object fills the ink
 * range however the camera exposed it. What stays near the sheet is dropped by
 * the print step's floor, which is a copier's background suppression.
 */
async function coverageFromPhoto(file, W, H) {
  const base = sharp(file).rotate().grayscale();
  const { data: raw, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const border = [];
  const band = Math.max(4, Math.round(Math.min(info.width, info.height) * 0.04));
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (x < band || y < band || x >= info.width - band || y >= info.height - band)
        border.push(raw[(y * info.width + x) * info.channels]);
  border.sort((a, b) => a - b);
  const sheet = border[Math.floor(border.length * 0.5)];
  const { data } = await base
    .resize(W, H, { fit: "contain", background: { r: sheet, g: sheet, b: sheet, alpha: 1 } })
    .flatten({ background: { r: sheet, g: sheet, b: sheet } })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sorted = Array.from(data).sort((a, b) => a - b);
  const black = sorted[Math.floor(sorted.length * 0.01)];
  const cov = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) cov[i] = Math.max(0, (sheet - data[i]) / Math.max(12, sheet - black));
  return { cov, W, H };
}

/* A photograph gets a floor: anything within a few percent of the sheet prints
   no ink, so uneven light across the paper does not come out as a grey wash. */
const PHOTO = { lo: 0.14, hi: 0.8, gamma: 0.9 };

/**
 * The print step. A tone curve sets the range, a little surface texture is
 * added, and a pixel is inked where its coverage beats a clumped random
 * threshold. Soft at the edge of each clump, so a dot reads as ink rather than
 * as a hard pixel.
 */
async function print(name, { cov, W, H }, { lo = 0, hi = 0.7, gamma = 0.85, tex = 0.08, sigma = 0.9, seed = 7 } = {}) {
  const T = clumpField(W, H, seed, sigma);
  const tx = fbm(W, H, seed + 11, [[Math.round(W / 26), 0.55], [Math.round(W / 9), 0.45]]);
  const dn = fbm(W, H, seed + 23, [[Math.max(2, Math.round(W / 140)), 1]]);
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (cov[i] < 0) continue;
    let c = (cov[i] - lo) / (hi - lo);
    c = c < 0 ? 0 : c > 1 ? 1 : c;
    // Bare paper prints nothing: neither the texture nor the soft dot edge may
    // put ink where none was asked for, or a photograph's white sheet comes
    // out speckled from edge to edge.
    if (c <= 0) continue;
    c = Math.pow(c, gamma) + tx[i] * tex;
    let v = (c - T[i]) * 7 + 0.5;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const d = 0.86 + 0.14 * (dn[i] * 0.5 + 0.5);
    out[i * 4 + 3] = Math.round(255 * v * d);
  }
  await writeMask(name, out, W, H);
}

/* Black, with the ink in alpha. Quantised to a 16 entry palette: the alpha only
   needs a handful of levels to keep the dot edges soft, and the palette is what
   makes per-pixel grain compress at all. */
async function writeMask(name, buf, W, H) {
  const file = `${OUT}/${name}.png`;
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ palette: true, colors: 16, compressionLevel: 9, effort: 10 })
    .toFile(file);
  console.log(`${name}.png`.padEnd(22), `${W}x${H}`.padEnd(10), `${Math.round(statSync(file).size / 1024)}KB`);
}

/* ------------------------------------------------------------------ */
/* KEYS: two keys on a split ring, each with a dark cap to print a      */
/* label on. The labels themselves are live text laid over the caps.    */
/* ------------------------------------------------------------------ */

function keyShape(gid) {
  const hole = "M 9 0 A 9 9 0 1 0 -9 0 A 9 9 0 1 0 9 0 Z";
  const bow = "M -46 12 Q -46 -22 -12 -22 L 12 -22 Q 46 -22 46 12 L 46 58 Q 46 80 24 80 L -24 80 Q -46 80 -46 58 Z";
  return `
  <path fill-rule="evenodd" d="${bow} ${hole}" fill="url(#bow${gid})" stroke="#262626" stroke-width="2.2"/>
  <path d="M -40 14 Q -40 -16 -12 -16 L 12 -16 Q 40 -16 40 14" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.85"/>
  <path d="M 44 20 L 44 58 Q 44 76 24 77" fill="none" stroke="#3a3a3a" stroke-width="3" opacity="0.7"/>
  <rect x="-36" y="20" width="72" height="42" rx="7" fill="#232323" stroke="#0f0f0f" stroke-width="1.2"/>
  <line x1="-30" y1="22" x2="30" y2="22" stroke="#6a6a6a" stroke-width="1.4"/>
  <rect x="-22" y="78" width="44" height="12" rx="2" fill="url(#metal)" stroke="#262626" stroke-width="1.6"/>
  <path d="M -13 88 L 13 88 L 13 120 L 25 128 L 25 140 L 17 148 L 25 156 L 25 168 L 17 176 L 27 186 L 21 198 L 27 206 L 13 222 L 6 240 L -13 234 Z" fill="url(#metal)" stroke="#262626" stroke-width="1.6"/>
  <path d="M -4 96 L 3 96 L 3 228 L -4 226 Z" fill="#5f5f5f"/>
  <line x1="-8.5" y1="95" x2="-8.5" y2="228" stroke="#ffffff" stroke-width="1.8" opacity="0.9"/>
  <line x1="10" y1="95" x2="10" y2="214" stroke="#3c3c3c" stroke-width="1.6" opacity="0.8"/>`;
}

/* The geometry the overlay in ZineParts.tsx depends on. Key A hangs from the
   ring at (170, 109) turned 40 degrees, key B at (226, 112) turned -8 degrees
   and scaled 0.92; each cap is centred 41 units down its key. Move these and
   the label positions there have to move with them. */
const keysSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700" viewBox="0 0 300 350">
<defs>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#555"/><stop offset="0.22" stop-color="#e6e6e6"/><stop offset="0.4" stop-color="#ffffff"/><stop offset="0.6" stop-color="#a2a2a2"/><stop offset="0.82" stop-color="#cfcfcf"/><stop offset="1" stop-color="#444"/>
  </linearGradient>
  <linearGradient id="bowA" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#d4d4d4"/><stop offset="0.55" stop-color="#8e8e8e"/><stop offset="0.78" stop-color="#e2e2e2"/><stop offset="1" stop-color="#4c4c4c"/>
  </linearGradient>
  <linearGradient id="bowB" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bdbdbd"/><stop offset="0.35" stop-color="#f4f4f4"/><stop offset="0.6" stop-color="#8a8a8a"/><stop offset="1" stop-color="#3e3e3e"/>
  </linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f7f7f7"/><stop offset="0.35" stop-color="#7d7d7d"/><stop offset="0.6" stop-color="#e8e8e8"/><stop offset="1" stop-color="#3a3a3a"/>
  </linearGradient>
</defs>
<g transform="translate(226 112) rotate(-8) scale(0.92)">${keyShape("B")}</g>
<g transform="translate(170 109) rotate(40)">${keyShape("A")}</g>
<ellipse cx="200" cy="70" rx="52" ry="48" fill="none" stroke="#262626" stroke-width="11.5"/>
<ellipse cx="200" cy="70" rx="52" ry="48" fill="none" stroke="url(#ring)" stroke-width="8.5"/>
<path d="M 160 40 A 52 48 0 0 1 222 26" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9"/>
<path d="M 248 86 A 52 48 0 0 1 205 118" fill="none" stroke="#202020" stroke-width="2"/>
</svg>`;

/* ------------------------------------------------------------------ */
/* MATCHBOX: front on, tray slid out. Three of them, because the count  */
/* of matches is the margin: a full box, a nearly empty one, an empty   */
/* one. The number on the label is still the figure; the matches only   */
/* agree with it, they never replace it.                                */
/* ------------------------------------------------------------------ */

function matchboxSvg(count) {
  const r = rng(91);
  let matches = "";
  for (let i = 0; i < count; i++) {
    const y = 76 + i * 10 + (r() - 0.5) * 2.4;
    const rot = (r() - 0.5) * 2.2;
    matches += `<g transform="rotate(${rot.toFixed(2)} 200 ${y.toFixed(1)})">
      <rect x="196" y="${(y - 3.2).toFixed(1)}" width="98" height="6.4" rx="2" fill="url(#wood)" stroke="#6b604f" stroke-width="0.8"/>
      <ellipse cx="297" cy="${y.toFixed(1)}" rx="8" ry="5.3" fill="url(#head)" stroke="#000" stroke-width="0.7"/>
    </g>`;
  }
  let grit = "";
  const g = rng(17);
  for (let i = 0; i < 260; i++) {
    const t = g(), u = g();
    grit += `<circle cx="${(8 + t * 200 + u * 14.3).toFixed(1)}" cy="${(62 - u * 10.9).toFixed(1)}" r="${(0.5 + g() * 0.9).toFixed(2)}" fill="${g() < 0.5 ? "#1c1c1c" : "#9a9a9a"}"/>`;
  }
  /* Framed to the box itself (y 44 to 186 of the drawing). The first frame was
     the full 200 units, and its empty top quarter pushed the box a third of an
     inch below whatever sat above it on the screen. The label overlay in
     ZineAttendance.tsx is measured against this frame. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="284" viewBox="0 44 340 142">
<defs>
  <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbfbfb"/><stop offset="0.7" stop-color="#ebebeb"/><stop offset="1" stop-color="#bcbcbc"/>
  </linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f4f4f4"/><stop offset="0.6" stop-color="#cfcfcf"/><stop offset="1" stop-color="#8d8d8d"/>
  </linearGradient>
  <radialGradient id="head" cx="0.35" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#8f8f8f"/><stop offset="0.45" stop-color="#2c2c2c"/><stop offset="1" stop-color="#0c0c0c"/>
  </radialGradient>
  <linearGradient id="inside" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5a5a5a"/><stop offset="1" stop-color="#a8a8a8"/>
  </linearGradient>
  <clipPath id="tray"><rect x="210" y="68" width="100" height="108"/></clipPath>
</defs>
<polygon points="208,62 222.3,51.1 222.3,171.1 208,182" fill="#2b2b2b"/>
<polygon points="208,66 312,66 326.3,55.1 222.3,55.1" fill="#d9d9d9" stroke="#2a2a2a" stroke-width="1.2"/>
<polygon points="312,66 326.3,55.1 326.3,167.1 312,178" fill="#7a7a7a" stroke="#2a2a2a" stroke-width="1.2"/>
<rect x="208" y="66" width="104" height="112" fill="url(#inside)" stroke="#2a2a2a" stroke-width="1.4"/>
<g clip-path="url(#tray)">${matches}</g>
<rect x="209.5" y="67.5" width="101" height="109" fill="none" stroke="#e9e9e9" stroke-width="3.2"/>
<polygon points="8,62 208,62 222.3,51.1 22.3,51.1" fill="#4a4a4a" stroke="#202020" stroke-width="1.2"/>
${grit}
<rect x="8" y="62" width="200" height="120" fill="url(#card)" stroke="#262626" stroke-width="1.8"/>
<line x1="209" y1="62" x2="209" y2="182" stroke="#111" stroke-width="2.4"/>
<line x1="10" y1="63.5" x2="206" y2="63.5" stroke="#ffffff" stroke-width="1.4"/>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* BARBED WIRE: two strands twisted together, and one knot of barbs at  */
/* exactly 75% of the width. That knot is the line.                     */
/* ------------------------------------------------------------------ */

function wireSvg(width, knotAt) {
  const H = 60, mid = 30, amp = 5.2, period = 30;
  const ya = (x) => mid + amp * Math.sin((2 * Math.PI * x) / period);
  const yb = (x) => mid - amp * Math.sin((2 * Math.PI * x) / period);
  const seg = (f, x0, x1) => {
    let d = `M ${x0.toFixed(2)} ${f(x0).toFixed(2)}`;
    for (let x = x0 + 0.5; x <= x1 + 0.001; x += 0.5) d += ` L ${x.toFixed(2)} ${f(x).toFixed(2)}`;
    return d;
  };
  const strand = (d) => `
    <path d="${d}" fill="none" stroke="#222" stroke-width="6.4"/>
    <path d="${d}" fill="none" stroke="#8e8e8e" stroke-width="4.4"/>
    <path d="${d}" fill="none" stroke="#fafafa" stroke-width="1.5" transform="translate(0 -1.2)"/>`;
  /* Half a twist at a time, alternating which strand is on top, so the two
     read as wound round each other rather than laid side by side. */
  let under = "", over = "";
  const half = period / 2;
  for (let k = 0; k * half < width; k++) {
    const x0 = Math.max(0, k * half - 0.6), x1 = Math.min(width, (k + 1) * half + 0.6);
    const top = k % 2 === 0 ? ya : yb, bottom = k % 2 === 0 ? yb : ya;
    under += strand(seg(bottom, x0, x1));
    over += strand(seg(top, x0, x1));
  }
  const kx = width * knotAt;
  let barbs = "";
  for (const [dx, dy] of [[-19, -23], [20, -25], [-21, 23], [19, 26]]) {
    const len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const bx = kx + dx * 0.12, by = mid + dy * 0.12;
    barbs += `<polygon points="${(bx + nx * 2.3).toFixed(1)},${(by + ny * 2.3).toFixed(1)} ${(kx + dx).toFixed(1)},${(mid + dy).toFixed(1)} ${(bx - nx * 2.3).toFixed(1)},${(by - ny * 2.3).toFixed(1)}" fill="#8a8a8a" stroke="#1f1f1f" stroke-width="1.1" stroke-linejoin="round"/>
    <line x1="${(bx + nx * 0.8).toFixed(1)}" y1="${(by + ny * 0.8).toFixed(1)}" x2="${(kx + dx * 0.85).toFixed(1)}" y2="${(mid + dy * 0.85).toFixed(1)}" stroke="#f2f2f2" stroke-width="0.9"/>`;
  }
  for (let w = -1; w <= 1; w++) {
    const x = kx + w * 5.2;
    barbs += `<path d="M ${x - 2.6} ${mid - 8.5} Q ${x + 4} ${mid} ${x - 2.6} ${mid + 8.5}" fill="none" stroke="#1f1f1f" stroke-width="5.4"/>
    <path d="M ${x - 2.6} ${mid - 8.5} Q ${x + 4} ${mid} ${x - 2.6} ${mid + 8.5}" fill="none" stroke="#b5b5b5" stroke-width="3.2"/>
    <path d="M ${x - 3.4} ${mid - 7} Q ${x + 2.4} ${mid} ${x - 3.4} ${mid + 7}" fill="none" stroke="#ffffff" stroke-width="1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${H * 2}" viewBox="0 0 ${width} ${H}">${under}${over}${barbs}</svg>`;
}

/* ------------------------------------------------------------------ */
/* THE INK GRAIN, a seamless tile. Mostly solid with clumped voids:     */
/* masked over the big figures, the stamps and the solid blocks, it is  */
/* what makes flat colour read as ink that went through a drum.         */
/* ------------------------------------------------------------------ */

async function grainTile() {
  const W = 256, H = 256;
  const T = clumpField(W, H, 404, 1.05, true);
  const dn = fbm(W, H, 405, [[4, 1]]);
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    let v = (0.9 - T[i]) * 9 + 0.5;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    out[i * 4 + 3] = Math.round(255 * v * (0.88 + 0.12 * (dn[i] * 0.5 + 0.5)));
  }
  await writeMask("grain", out, W, H);
}

/** A photo in print-src for this object, if there is one. */
function photoFor(name) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const f = `${SRC}/${name}.${ext}`;
    if (existsSync(f)) return f;
  }
  return null;
}

async function object(name, svg, W, H, opts) {
  const photo = photoFor(name);
  if (photo) console.log(`  using the photograph ${photo}`);
  const cov = photo ? await coverageFromPhoto(photo, W, H) : await coverageFromSvg(svg);
  await print(name, cov, photo ? { ...opts, ...PHOTO } : opts);
}

await mkdir(OUT, { recursive: true });
await object("keys", keysSvg, 600, 700, { seed: 3 });
await object("matchbox-full", matchboxSvg(10), 680, 284, { seed: 5, lo: 0.02, hi: 0.74, gamma: 0.9 });
await object("matchbox-low", matchboxSvg(2), 680, 284, { seed: 5, lo: 0.02, hi: 0.74, gamma: 0.9 });
await object("matchbox-empty", matchboxSvg(0), 680, 284, { seed: 5, lo: 0.02, hi: 0.74, gamma: 0.9 });
await print("wire", await coverageFromSvg(wireSvg(360, 0.75)), { seed: 9, lo: 0.04, hi: 0.8, gamma: 1, sigma: 0.75 });
await grainTile();
