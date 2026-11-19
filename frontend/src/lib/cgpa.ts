// CGPA planner.
//
// Pure logic, no React, so node scripts can import it and test it.
//
// **Why this is a planner and not a prediction.** A GPA projection was removed
// from the marks page once already, and the reason stands: a grade each subject
// is "on track" for, quoted to two decimals, is a projection built on
// projections. So nothing here claims to know your grades. You choose them, or
// you choose a target and it works out the cheapest grades that reach it, and
// every grade it offers carries what it would actually take in the exam. The
// marks in hand decide which grades are still possible and what each one costs;
// the choice stays yours.
//
// The one currency is **marks out of 100 above your current pace** ("effort").
// Pace is what a subject finishes on if you keep scoring the way you have been,
// so a grade at or below your pace costs nothing, and the grade above it costs
// the distance to its cutoff. Because every subject is measured in the same
// unit, the target planner can compare raising a 4 credit lab with raising a 3
// credit theory paper and spend effort where it moves the CGPA furthest.

import { GRADES, forecastSubject, gradeFor } from "./grades";

const EPS = 1e-9;
const ceil = (n: number) => Math.ceil(n - EPS);

export type PlanGrade = (typeof GRADES)[number]["grade"] | "F";

export function pointsOf(grade: string): number {
  return GRADES.find((g) => g.grade === grade)?.points ?? 0;
}

/** One published marks row for a course (theory and lab arrive separately). */
export type MarksRow = { scored: number; publishedMax: number; isPractical: boolean };

export type GradeOption = {
  grade: PlanGrade;
  points: number;
  cutoff: number;
  /**
   * Still possible with the marks already dropped. An unreachable grade can
   * still be picked (the planner is for checking "what if"), it is just
   * flagged, with `shortBy` saying how far off it is.
   */
  reachable: boolean;
  /** Marks out of 100 the course falls short by even with full marks from here. 0 when reachable. */
  shortBy: number;
  /** Already guaranteed by the marks in hand. */
  secured: boolean;
  /** Marks out of 100 above your current pace. 0 when pace already reaches it. */
  effort: number;
  /**
   * What the exam has to deliver, assuming every remaining internal mark.
   * Quoted on the paper the student sits (75 theory, 40 practical) when the
   * course has one paper, as a percentage when it pools a theory and a lab.
   * Null when there is no exam or nothing has been published.
   */
  exam: { need: number; outOf: number; unit: "marks" | "percent" } | null;
};

export type PlanCourse = {
  code: string;
  title: string;
  credit: number;
  /** False when no assessment has been published: its grade is a free choice. */
  hasMarks: boolean;
  /** Where the course finishes, out of 100, at the current rate. */
  pace: number;
  paceGrade: PlanGrade;
  /** Best grade still reachable. F when even full marks from here fall short. */
  bestGrade: PlanGrade;
  /** O down to C, then F. */
  options: GradeOption[];
  internalOnly: boolean;
};

/** SRM's absolute cutoffs as points, for turning a CGPA back into a total. */
const LADDER = [...GRADES].reverse(); // C (5) .. O (10)

/**
 * The total out of 100 a grade point average corresponds to, by interpolating
 * between cutoffs. Used to give an unmarked course a sensible starting pace:
 * someone who has held an 8.4 is assumed to keep scoring like it, not like a
 * stranger.
 */
export function totalForPoints(points: number): number {
  if (points <= 5) return 50;
  if (points >= 10) return 91;
  const lo = LADDER[Math.floor(points) - 5];
  const hi = LADDER[Math.floor(points) - 4] ?? lo;
  return lo.cutoff + (points - Math.floor(points)) * (hi.cutoff - lo.cutoff);
}

/**
 * Builds the planner's view of one course.
 *
 * A course can arrive as several marks rows sharing a code (theory and lab
 * assessed separately). They are pooled as equal halves of one grade: each row
 * is its own 100, and the course total is their mean. With one row this is
 * exactly `forecastSubject`, which is what keeps the planner and the marks page
 * quoting the same exam requirement for the same grade.
 */
export function planCourse(opts: {
  code: string;
  title: string;
  credit: number;
  rows: MarksRow[];
  /** Pace for a course with nothing published, out of 100. */
  fallbackPace: number;
}): PlanCourse {
  const { code, title, credit, rows, fallbackPace } = opts;
  const forecasts = rows
    .map((r) => forecastSubject(r))
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const options: GradeOption[] = [];
  const grades: { grade: PlanGrade; cutoff: number }[] = [
    ...GRADES.map((g) => ({ grade: g.grade as PlanGrade, cutoff: g.cutoff })),
    { grade: "F", cutoff: 0 },
  ];

  if (forecasts.length === 0) {
    const pace = clamp(fallbackPace, 0, 100);
    for (const { grade, cutoff } of grades) {
      options.push({
        grade,
        points: pointsOf(grade),
        cutoff,
        reachable: true,
        shortBy: 0,
        secured: grade === "F",
        effort: Math.max(0, cutoff - pace),
        exam: null,
      });
    }
    return {
      code, title, credit, hasMarks: false, pace,
      paceGrade: gradeFor(pace) as PlanGrade,
      bestGrade: "O",
      options,
      internalOnly: false,
    };
  }

  const n = forecasts.length;
  const S = sum(forecasts.map((f) => f.scored));
  const R = sum(forecasts.map((f) => f.remainingInternal));
  const W = sum(forecasts.map((f) => (f.internalOnly ? 0 : 40)));
  const pace = sum(forecasts.map((f) => (f.scored / f.publishedMax) * 100)) / n;
  const best = (S + R + W) / n;
  const single = n === 1 ? forecasts[0] : null;

  for (const { grade, cutoff } of grades) {
    const target = cutoff * n;
    const reachable = best + EPS >= cutoff;
    const secured = S + EPS >= target;
    let exam: GradeOption["exam"] = null;
    // Computed for an unreachable grade too: "you would need 82 out of 75" is
    // the clearest way to say a grade is gone.
    if (W > 0 && !secured) {
      const fromExam = Math.max(0, target - S - R);
      const fraction = fromExam / W;
      exam =
        single && single.semPaper > 0
          ? { need: ceil(fraction * single.semPaper), outOf: single.semPaper, unit: "marks" }
          : { need: ceil(fraction * 100), outOf: 100, unit: "percent" };
    }
    options.push({
      grade,
      points: pointsOf(grade),
      cutoff,
      reachable,
      shortBy: reachable ? 0 : ceil(cutoff - best),
      secured,
      effort: Math.max(0, cutoff - pace),
      exam,
    });
  }

  return {
    code, title, credit, hasMarks: true, pace,
    paceGrade: gradeFor(pace) as PlanGrade,
    bestGrade: gradeFor(best) as PlanGrade,
    options,
    internalOnly: W === 0,
  };
}

export function optionFor(course: PlanCourse, grade: string): GradeOption {
  return course.options.find((o) => o.grade === grade) ?? course.options[course.options.length - 1];
}

/** The best grade at or below `grade` that is still reachable. */
export function clampGrade(course: PlanCourse, grade: string): PlanGrade {
  const i = course.options.findIndex((o) => o.grade === grade);
  for (let k = Math.max(0, i); k < course.options.length; k++) {
    if (course.options[k].reachable) return course.options[k].grade;
  }
  return "F";
}

// ---------- Averages ----------------------------------------------

export function sgpa(courses: PlanCourse[], grades: Record<string, string>): number | null {
  const credits = sum(courses.map((c) => c.credit));
  if (credits <= 0) return null;
  return sum(courses.map((c) => c.credit * pointsOf(grades[c.code] ?? c.paceGrade))) / credits;
}

/** Folds this semester into the record so far. With no record, CGPA is the SGPA. */
export function combine(opts: {
  prevCgpa: number | null;
  prevCredits: number;
  semGpa: number;
  semCredits: number;
}): number {
  const { prevCgpa, prevCredits, semGpa, semCredits } = opts;
  if (prevCgpa === null || prevCredits <= 0) return semGpa;
  const total = prevCredits + semCredits;
  return total > 0 ? (prevCgpa * prevCredits + semGpa * semCredits) / total : semGpa;
}

/** The SGPA this semester has to land for the CGPA to reach `target`. */
export function requiredSgpa(opts: {
  target: number;
  prevCgpa: number | null;
  prevCredits: number;
  semCredits: number;
}): number {
  const { target, prevCgpa, prevCredits, semCredits } = opts;
  if (prevCgpa === null || prevCredits <= 0 || semCredits <= 0) return target;
  return (target * (prevCredits + semCredits) - prevCgpa * prevCredits) / semCredits;
}

/**
 * Truncated, never rounded, to two places. SRM prints CGPA to two decimals, and
 * rounding 8.996 up would tell a student they made a 9.00 they did not.
 */
export function fmtGpa(n: number): string {
  return (Math.floor(n * 100 + EPS) / 100).toFixed(2);
}

/**
 * Rounded UP to two places, for a requirement. An SGPA of 8.905 needed is an
 * 8.91 to aim for: quoting 8.90 would send a student for a figure that falls
 * short by the width of the truncation.
 */
export function fmtNeed(n: number): string {
  return (Math.ceil(Math.max(0, n) * 100 - EPS) / 100).toFixed(2);
}

// ---------- The target planner -------------------------------------

export type Plan = {
  grades: Record<string, PlanGrade>;
  sgpa: number;
  /** Total marks above pace the plan asks for, summed across courses. */
  effort: number;
  /** Courses the plan asks for more than your pace in. */
  raised: string[];
  reachable: boolean;
};

/**
 * The cheapest set of grades whose SGPA reaches `target`.
 *
 * Starts every course at its pace grade (what you get by carrying on as you
 * are), then raises one grade at a time, always taking the step that buys the
 * most credit-weighted points per mark of extra effort. Greedy rather than
 * exhaustive, and that is fine: cutoffs are 5 to 10 marks apart and each step
 * is worth one point, so the cost of a step only ever rises as a course
 * climbs, which is the shape greedy gets right.
 *
 * Ties go to the course with more credits, then to the one already closer to
 * its next cutoff.
 */
export function cheapestPlan(courses: PlanCourse[], target: number): Plan {
  const grades: Record<string, PlanGrade> = {};
  for (const c of courses) grades[c.code] = clampGrade(c, c.paceGrade);

  const credits = sum(courses.map((c) => c.credit));
  const current = () =>
    credits > 0 ? sum(courses.map((c) => c.credit * pointsOf(grades[c.code]))) / credits : 0;

  for (let guard = 0; guard < 200 && current() + EPS < target; guard++) {
    let pick: { code: string; grade: PlanGrade; ratio: number; credit: number; cost: number } | null = null;
    for (const c of courses) {
      const i = c.options.findIndex((o) => o.grade === grades[c.code]);
      if (i <= 0) continue;
      // F to C is a five point jump, so look one rung up whatever it is.
      const next = c.options[i - 1];
      if (!next.reachable) continue;
      const cost = next.effort - c.options[i].effort;
      const gain = c.credit * (next.points - c.options[i].points);
      if (gain <= 0) continue;
      const ratio = cost / gain;
      if (
        !pick ||
        ratio < pick.ratio - EPS ||
        (Math.abs(ratio - pick.ratio) < EPS &&
          (c.credit > pick.credit || (c.credit === pick.credit && cost < pick.cost)))
      ) {
        pick = { code: c.code, grade: next.grade, ratio, credit: c.credit, cost };
      }
    }
    if (!pick) break;
    grades[pick.code] = pick.grade;
  }

  const raised = courses
    .filter((c) => pointsOf(grades[c.code]) > pointsOf(clampGrade(c, c.paceGrade)))
    .map((c) => c.code);
  return {
    grades,
    sgpa: current(),
    effort: sum(courses.map((c) => optionFor(c, grades[c.code]).effort)),
    raised,
    reachable: current() + EPS >= target,
  };
}

/** Every course at the best grade it can still reach. */
export function ceilingGrades(courses: PlanCourse[]): Record<string, PlanGrade> {
  return Object.fromEntries(courses.map((c) => [c.code, c.bestGrade]));
}

// ---------- Small helpers -------------------------------------------

/** "5", "V", "Semester 5" all read as 5. Null when it cannot be read. */
export function parseSemester(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.match(/\d+/);
  if (digits) return Number(digits[0]) || null;
  const roman = raw.toUpperCase().match(/\b(X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  if (!roman) return null;
  return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].indexOf(roman[1]) + 1;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
