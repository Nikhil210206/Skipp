// The profile mark, generated from the student's registration number.
//
// Deterministic on purpose: the same number always gives the same mark, so it
// is recognisably yours without anyone choosing anything and without a byte of
// it being stored. Two students sitting next to each other see two different
// marks, which is most of the point.
//
// Mirrored down the middle, the way an identicon is, because a symmetrical
// figure reads as a mark at 32px where an arbitrary one reads as noise.

const GRID = 5;
/** Only the left half plus the spine is generated; the rest is a reflection. */
const UNIQUE_COLS = 3;

export type MarkCell = { x: number; y: number; accent: boolean };

/** FNV-1a. Small, dependency free, and well spread for short strings. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The lit cells for a seed. 15 generated bits, mirrored, with one cell in the
 * accent so every mark has a single point of colour in its own place.
 */
export function markCells(seed: string): MarkCell[] {
  const h = hash(seed || "skipp");
  const lit: { x: number; y: number }[] = [];

  for (let x = 0; x < UNIQUE_COLS; x++) {
    for (let y = 0; y < GRID; y++) {
      if (((h >> (x * GRID + y)) & 1) === 1) lit.push({ x, y });
    }
  }

  // A mark that is nearly empty or nearly solid is not a mark. Nudge the
  // sparse case with a second pass rather than rejecting the seed, so the
  // result stays a pure function of the number.
  if (lit.length < 4) {
    const g = hash(`${seed}:fill`);
    for (let i = 0; i < UNIQUE_COLS * GRID && lit.length < 6; i++) {
      const x = Math.floor(i / GRID);
      const y = i % GRID;
      if (((g >> i) & 1) === 1 && !lit.some((c) => c.x === x && c.y === y)) {
        lit.push({ x, y });
      }
    }
  }

  const accentAt = lit.length > 0 ? hash(`${seed}:accent`) % lit.length : -1;

  const cells: MarkCell[] = [];
  lit.forEach((c, i) => {
    const accent = i === accentAt;
    cells.push({ ...c, accent });
    // Reflect everything except the centre column, which is the spine.
    if (c.x < UNIQUE_COLS - 1) {
      cells.push({ x: GRID - 1 - c.x, y: c.y, accent });
    }
  });
  return cells;
}

export const MARK_GRID = GRID;
