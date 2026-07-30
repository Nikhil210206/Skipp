// THE MARK.
//
// A mortarboard sitting on a rule. The cap says college without a word of
// explanation, and the rule under it is the app's own device, the same hairline
// the 75% tick sits on across every screen. So the mark reads as "a student,
// and the line they answer to".
//
// The tassel is the only accent, and it is doing two jobs: it is the detail
// that makes a cap a cap, and it is the one vertical stroke against all those
// horizontals, which is what stops the mark reading as a flat stack.
//
// Drawn in a 32 unit box, flat, no gradients, legible at 16px.
//
// This module is the single source of truth for the geometry: the React
// component renders it, and scripts/make-icons.mjs draws the PNGs from it.

export const BOX = 32;

/** The board, seen in perspective. */
export const BOARD = "M3.8 10.7 L16 4.7 L28.2 10.7 L16 16.7 Z";

/** The cap under it, peeking out below the board's lower point. */
export const BODY =
  "M10.6 15.1 L10.6 19.3 C10.6 19.3 16 22.5 21.4 19.3 L21.4 15.1 Z";

/** The tassel, hung from the board's right corner. */
export const TASSEL_CORD = "M28.2 10.7 L28.2 20";
export const TASSEL_CORD_W = 1.3;
/** Clearly wider than the cord, or the two read as one plain stick. */
export const TUFT = { x: 26.6, y: 19.8, w: 3.2, h: 4.2, r: 1.6 } as const;

/**
 * Where the tassel is tied on. The launch swings it from here, which has to be
 * given to GSAP as `svgOrigin` in user units: `transform-box: fill-box` would
 * pin the origin to the tassel's own box instead of to the cap.
 */
export const TASSEL_PIVOT = { x: 28.2, y: 10.7 } as const;

/** The line the cap sits on. */
export const RULE = { x: 2.6, y: 25.6, w: 26.4, h: 1.8, r: 0.9 } as const;

/**
 * The mark as a standalone SVG document, for the PNG icons.
 *
 * `bg` null leaves the tile transparent. `radius` is in the same 32 unit space
 * as everything else, so a full bleed tile (for a maskable or an iOS icon,
 * where the platform applies its own mask) is radius 0. The icons are one
 * colour by brand, so the tassel is drawn in `fg` like everything else.
 */
export function logoSvg({
  size,
  fg,
  bg = null,
  radius = 0,
  inset = 0,
}: {
  size: number;
  fg: string;
  bg?: string | null;
  radius?: number;
  /** Shrinks the mark toward the middle, for a maskable safe zone. */
  inset?: number;
}): string {
  const scale = (BOX - inset * 2) / BOX;
  const tile = bg
    ? `<rect width="${BOX}" height="${BOX}" rx="${radius}" fill="${bg}"/>`
    : "";
  const parts = [
    `<path d="${BOARD}" fill="${fg}"/>`,
    `<path d="${BODY}" fill="${fg}"/>`,
    `<path d="${TASSEL_CORD}" stroke="${fg}" stroke-width="${TASSEL_CORD_W}" stroke-linecap="round" fill="none"/>`,
    `<rect x="${TUFT.x}" y="${TUFT.y}" width="${TUFT.w}" height="${TUFT.h}" rx="${TUFT.r}" fill="${fg}"/>`,
    `<rect x="${RULE.x}" y="${RULE.y}" width="${RULE.w}" height="${RULE.h}" rx="${RULE.r}" fill="${fg}"/>`,
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${BOX} ${BOX}">${tile}<g transform="translate(${inset} ${inset}) scale(${scale})">${parts}</g></svg>`;
}
