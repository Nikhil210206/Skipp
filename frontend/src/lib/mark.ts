// The profile character, generated from the student's registration number.
//
// It replaced an identicon, a 5x5 grid of dots, which was deterministic and
// unique and **did not read as a person**. Nobody pressed it, because an
// abstract pattern in a corner looks like decoration. A face needs no
// explaining: it is obviously you, and it is obviously pressable.
//
// Deterministic on purpose: the same number always draws the same character,
// so it is recognisably yours without anyone choosing anything and without a
// byte of it being stored. Two students sitting together see two different
// faces, which is most of the point.

/**
 * FNV-1a. Small, dependency free, and well spread for short strings.
 *
 * Exported because anything else keyed to a student should be keyed to the SAME
 * number: the welcome screen's crowd takes its drift and blink timings from
 * this, so a face's motion is as deterministic as the face itself.
 */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Face = {
  /** What is on top: nothing, a tuft, a side sweep, a cap. */
  top: 0 | 1 | 2 | 3;
  /** Dots, arcs (content), or wide (surprised). */
  eyes: 0 | 1 | 2;
  /** Smile, straight, open, smirk. */
  mouth: 0 | 1 | 2 | 3;
  /** A few degrees of tilt, because a perfectly level head looks lifeless. */
  tilt: number;
  /** Whether the shoulders carry a collar notch. */
  collar: boolean;
};

/**
 * The character for a seed. Every field is drawn from a different slice of the
 * hash, so two adjacent registration numbers do not produce near identical
 * faces the way sequential ids otherwise would.
 *
 * **Every shift here must be `>>>`, not `>>`.** `hashSeed` returns a uint32,
 * but a SIGNED shift converts it back to an int32 first, so any hash with its
 * top bit set (about half of them) came out negative, and a negative `%` stays
 * negative in JavaScript and indexes off the FRONT of these lists. Measured
 * over 2000 registration numbers, that quietly cost most of the variety this
 * function exists to provide:
 *
 *     tilt          undefined for 39.5% of numbers, which is also an invalid
 *                   SVG `transform` attribute and a console error on every
 *                   face that drew one
 *     no top        58% of students, against the 25% intended
 *     level head    49%, against 17%, and a level head is the exact thing the
 *                   tilt was added to prevent
 *     rendered      488 distinct characters, against 566
 *
 * Fixing it changes the character an existing registration number draws, once.
 * That is a fair price: the face is generated rather than chosen, nothing about
 * it is stored, and the property that matters, that one number always draws one
 * character, is untouched.
 */
export function faceFor(seed: string): Face {
  const h = hashSeed(seed || "skipp");
  const tilts = [-6, -3, 0, 3, 6, -4];
  return {
    top: ((h >>> 2) % 4) as Face["top"],
    eyes: ((h >>> 7) % 3) as Face["eyes"],
    mouth: ((h >>> 11) % 4) as Face["mouth"],
    tilt: tilts[(h >>> 17) % tilts.length],
    collar: ((h >>> 23) & 1) === 1,
  };
}

/** The box every part is drawn in. */
export const FACE_BOX = 24;
