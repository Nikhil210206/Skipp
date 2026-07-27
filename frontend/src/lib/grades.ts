// Grade prediction from published internal marks.
//
// SRM's model, which the naive "internals + final = 100" reading gets wrong:
//
//   Theory course      internals total 60, end-semester exam total 40.
//                      The exam is conducted out of 75 and scaled down to 40,
//                      so the number a student needs to hear is out of 75.
//   Practical course   same 60/40 split, but the exam is conducted out of 40.
//   Internal-only      some courses carry the full 100 internally and have no
//                      exam at all, so the grade settles when marks publish.
//
// Crucially the internals are published progressively. Halfway through a term a
// subject might show 25/25: that is 25 of an eventual 60, not a 25-mark course.
// Everything below works from the marks in hand plus the internal marks still to
// come, which is what makes the forecast honest mid-term.

/** SRM absolute scale, best first. */
export const GRADES = [
  { grade: "O", cutoff: 91, points: 10 },
  { grade: "A+", cutoff: 81, points: 9 },
  { grade: "A", cutoff: 71, points: 8 },
  { grade: "B+", cutoff: 61, points: 7 },
  { grade: "B", cutoff: 56, points: 6 },
  { grade: "C", cutoff: 50, points: 5 },
] as const;

const INTERNAL_CEILING = 60;
const INTERNAL_ONLY_CEILING = 100;
const SEM_WEIGHT = 40;
const SEM_PAPER_THEORY = 75;
const SEM_PAPER_PRACTICAL = 40;

// Marks are whole numbers; floating point turns a clean 20 into 20.000000000004.
const EPS = 1e-9;
const ceil = (n: number) => Math.ceil(n - EPS);

export type GradeTarget = {
  grade: string;
  cutoff: number;
  /** Marks needed out of the exam's 40 mark weighting. */
  neededWeight: number;
  /** The same requirement expressed on the paper the student actually sits. */
  semNeeded: number;
  secured: boolean;
  outOfReach: boolean;
};

export type SubjectForecast = {
  scored: number;
  /** Internal maximum published so far, not the eventual internal total. */
  publishedMax: number;
  /** 60 for a course with an exam, 100 for an internal-only one. */
  internalCeiling: number;
  /** Internal marks not yet published. */
  remainingInternal: number;
  internalOnly: boolean;
  /** What the exam paper is marked out of: 75 theory, 40 practical, 0 if none. */
  semPaper: number;
  /** Best total still reachable, given internal marks already dropped. */
  bestPossibleTotal: number;
  bestGrade: string;
  /** Where the current rate lands if it holds for the rest of the course. */
  onTrackGrade: string;
  targets: GradeTarget[];
};

export function gradeFor(total: number): string {
  for (const g of GRADES) if (total + EPS >= g.cutoff) return g.grade;
  return "F";
}

export function pointsFor(grade: string): number {
  return GRADES.find((g) => g.grade === grade)?.points ?? 0;
}

/** Returns null until something is published: a forecast from no data is noise. */
export function forecastSubject(opts: {
  scored: number;
  publishedMax: number;
  isPractical?: boolean;
}): SubjectForecast | null {
  const { scored, publishedMax, isPractical = false } = opts;
  if (publishedMax <= 0) return null;

  // A published internal maximum above 60 can only mean the course carries its
  // whole 100 internally.
  const internalOnly = publishedMax > INTERNAL_CEILING;
  const internalCeiling = internalOnly ? INTERNAL_ONLY_CEILING : INTERNAL_CEILING;
  const remainingInternal = Math.max(0, internalCeiling - publishedMax);
  const semWeight = internalOnly ? 0 : SEM_WEIGHT;
  const semPaper = internalOnly
    ? 0
    : isPractical
      ? SEM_PAPER_PRACTICAL
      : SEM_PAPER_THEORY;

  // Marks already dropped internally can never be won back.
  const bestPossibleTotal = scored + remainingInternal + semWeight;
  const rate = scored / publishedMax;
  const onTrack = rate * internalCeiling + rate * semWeight;

  const targets: GradeTarget[] = GRADES.map(({ grade, cutoff }) => {
    // Requirements are quoted on marks in hand, so they never assume marks the
    // student has not earned yet.
    const gap = cutoff - scored;
    if (gap <= EPS) {
      return {
        grade, cutoff, neededWeight: 0, semNeeded: 0,
        secured: true, outOfReach: false,
      };
    }
    if (cutoff > bestPossibleTotal + EPS) {
      return {
        grade, cutoff, neededWeight: ceil(gap), semNeeded: 0,
        secured: false, outOfReach: true,
      };
    }
    // What is left after the remaining internals must come from the exam.
    const fromExam = Math.max(0, gap - remainingInternal);
    return {
      grade,
      cutoff,
      neededWeight: ceil(fromExam),
      semNeeded: semWeight > 0 ? ceil((fromExam / semWeight) * semPaper) : 0,
      secured: false,
      outOfReach: false,
    };
  });

  return {
    scored,
    publishedMax,
    internalCeiling,
    remainingInternal,
    internalOnly,
    semPaper,
    bestPossibleTotal,
    bestGrade: gradeFor(bestPossibleTotal),
    onTrackGrade: gradeFor(onTrack),
    targets,
  };
}

/** Credit-weighted GPA across whatever grades are supplied. */
export function predictGpa(
  entries: { grade: string; credit: number }[],
): number | null {
  const counted = entries.filter((e) => e.credit > 0);
  if (counted.length === 0) return null;
  const credits = counted.reduce((n, e) => n + e.credit, 0);
  const points = counted.reduce((n, e) => n + pointsFor(e.grade) * e.credit, 0);
  return credits > 0 ? points / credits : null;
}
