// Client-side attendance predictor — mirrors backend/services/predictor.py so
// the target threshold and "what-if skip" projections recompute instantly from
// the raw attended/conducted counts, no refetch needed.

export type Prediction = {
  percentage: number;
  canSkip: number; // classes you can still miss and stay >= target
  mustAttend: number; // classes to attend in a row to reach target (0 if safe)
  isSafe: boolean;
};

export function predict(
  attended: number,
  conducted: number,
  threshold: number,
): Prediction {
  if (conducted <= 0) {
    return { percentage: 0, canSkip: 0, mustAttend: 0, isSafe: true };
  }
  const pct = (attended / conducted) * 100;
  const t = threshold / 100;
  const isSafe = pct >= threshold;

  // Epsilon guards: floating-point error can push an exact 7 to 7.0000002 and
  // flip floor/ceil by one (e.g. mustAttend showing 8 instead of 7).
  const EPS = 1e-9;
  let canSkip = 0;
  let mustAttend = 0;
  if (isSafe) {
    canSkip = t > 0 ? Math.max(0, Math.floor(attended / t - conducted + EPS)) : 0;
  } else {
    mustAttend =
      t < 1 ? Math.max(0, Math.ceil((t * conducted - attended) / (1 - t) - EPS)) : 0;
  }
  return { percentage: Math.round(pct * 100) / 100, canSkip, mustAttend, isSafe };
}

/** Projected % if you skip `skip` more classes (attend none of them). */
export function projectSkip(
  attended: number,
  conducted: number,
  skip: number,
): number {
  const c = conducted + skip;
  return c > 0 ? Math.round((attended / c) * 10000) / 100 : 0;
}

/** Projected % if you attend all of the next `attend` classes. */
export function projectAttend(
  attended: number,
  conducted: number,
  attend: number,
): number {
  const c = conducted + attend;
  return c > 0 ? Math.round(((attended + attend) / c) * 10000) / 100 : 0;
}
