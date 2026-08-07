// What your attendance will actually read on the day you get back.
//
// The forecast walks the calendar from today to the last date you picked and
// plays the term forward: every working day in between holds classes you would
// sit, and the days you picked hold classes you would miss. Both move the
// conducted count; only the days you attend move the attended count.
//
// **Counting the days in between is the whole point.** An earlier version took
// today's totals and only added the missed classes, which is right for leave
// tomorrow and increasingly wrong the further out you look: attending is what
// pushes a percentage back up, so ignoring a fortnight of classes made a
// distant leave date look far more expensive than it really is. At 42/43, four
// classes missed two weeks out reads as 89.4% that way and 93.8% in truth.

import type { Attendance, CalendarDay, DayOrderSchedule } from "@/types";

export type ProjectedSubject = {
  code: string;
  title: string;
  attendedBefore: number;
  conductedBefore: number;
  attendedAfter: number;
  conductedAfter: number;
  pctBefore: number;
  pctAfter: number;
  /** Classes of this subject held between now and the end of the plan. */
  held: number;
  /** How many of those you would miss, i.e. the cost of this leave. */
  missed: number;
};

export type Projection = {
  subjects: ProjectedSubject[];
  overallBefore: number;
  overallAfter: number;
  /** Days you picked that actually hold classes. */
  affectedDays: number;
  /** Working days in the window you would attend as normal. */
  attendedDays: number;
  /** Every class held in that window, attended and missed alike. */
  totalHeld: number;
  /** Just the ones you would miss. */
  totalMissed: number;
  /** The last date the projection runs to, or null when nothing is picked. */
  through: string | null;
};

const pct = (a: number, c: number) => (c > 0 ? (a / c) * 100 : 0);

// A course can have separate Theory + Practical attendance rows sharing one
// code, so we key by code + lab-ness: theory periods (slots A-G) hit the theory
// row, lab periods (P##/L##) hit the practical row.
const keyOf = (code: string, isLab: boolean) => `${code}::${isLab ? "lab" : "th"}`;

/** Periods per (code, lab-ness) on a day order. The code is carried alongside
 *  so a key that matches no attendance row can still be resolved by course. */
function classesByKey(
  dayOrders: DayOrderSchedule[],
  dayOrder: number | null,
): Map<string, { code: string; n: number }> {
  const m = new Map<string, { code: string; n: number }>();
  if (dayOrder == null) return m;
  const sched = dayOrders.find((d) => d.dayOrder === dayOrder);
  for (const c of sched?.classes ?? []) {
    const k = keyOf(c.code, c.isLab);
    const seen = m.get(k);
    m.set(k, { code: c.code, n: (seen?.n ?? 0) + 1 });
  }
  return m;
}

export function projectAttendance(opts: {
  attendance: Attendance;
  calendar: CalendarDay[];
  /** Must already exclude optional courses: pass `attendingDayOrders`. */
  dayOrders: DayOrderSchedule[];
  /** Dates the student plans to take off, as YYYY-MM-DD. */
  leaveDates: string[];
  /** Today, as YYYY-MM-DD. Injectable so the maths can be tested. */
  today?: string;
}): Projection {
  const { attendance, calendar, dayOrders, leaveDates } = opts;
  const now = new Date();
  const today =
    opts.today ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

  const subjects: ProjectedSubject[] = [];
  // A list per key, not a single row. Two attendance rows can share a code and
  // a lab-ness (the portal is free to report a course twice), and a plain Map
  // let the second silently replace the first, so the projection landed on the
  // wrong row and the right one never moved.
  const byKey = new Map<string, ProjectedSubject[]>();
  // The same rows keyed by course alone, for the fallback below.
  const byCode = new Map<string, ProjectedSubject[]>();
  for (const s of attendance.subjects) {
    const ps: ProjectedSubject = {
      code: s.code,
      title: s.title || s.code,
      attendedBefore: s.attended,
      conductedBefore: s.conducted,
      attendedAfter: s.attended,
      conductedAfter: s.conducted,
      pctBefore: pct(s.attended, s.conducted),
      pctAfter: pct(s.attended, s.conducted),
      held: 0,
      missed: 0,
    };
    subjects.push(ps);
    const isLab = /practical|lab/i.test(s.category) || s.slot === "LAB";
    const k = keyOf(s.code, isLab);
    byKey.set(k, [...(byKey.get(k) ?? []), ps]);
    byCode.set(s.code, [...(byCode.get(s.code) ?? []), ps]);
  }

  /**
   * Applies one day's classes to the right rows, and returns how many periods
   * that day held. `attended` decides whether it is a day you sit or take off.
   */
  function applyDay(dayOrder: number | null, attended: boolean): number {
    const counts = classesByKey(dayOrders, dayOrder);
    let total = 0;
    for (const [k, { code, n }] of counts) {
      // Exact match on code AND lab-ness first.
      let rows = byKey.get(k);
      if (!rows?.length) {
        // **Nothing matched on lab-ness, so fall back to the course itself.**
        // The timetable decides lab-ness from the slot (P##/L##) while the
        // attendance row decides it from the portal's own category text, and
        // the two can disagree. When they did, the class was dropped in
        // silence, understating the damage in the one direction that matters.
        //
        // Only when the course has exactly ONE row, where there is no ambiguity
        // about where the hit belongs. A course with both a theory and a
        // practical row always matches one of them exactly, so this cannot
        // misroute a split course.
        const single = byCode.get(code);
        rows = single?.length === 1 ? single : undefined;
      }
      // A course the attendance page has never heard of cannot be projected.
      if (!rows?.length) continue;

      total += n;
      for (const subj of rows) {
        subj.conductedAfter += n;
        subj.held += n;
        if (attended) subj.attendedAfter += n;
        else subj.missed += n;
      }
    }
    return total;
  }

  // Deduped: the same day off twice is still one day off. The picker cannot
  // currently produce a repeat, but nothing in this function's contract says
  // it will not, and a silent double count would overstate the damage.
  const leave = new Set(leaveDates);
  const through = leave.size ? [...leave].sort().at(-1)! : null;

  let affectedDays = 0;
  let attendedDays = 0;
  let totalHeld = 0;
  let totalMissed = 0;

  if (through) {
    // Every calendar day from today to the last date picked. A holiday has no
    // day order and so contributes nothing, which is exactly right: a holiday
    // inside a plan neither costs attendance nor earns it.
    for (const day of calendar) {
      if (day.date < today || day.date > through) continue;
      if (day.dayOrder == null) continue;
      const isLeave = leave.has(day.date);
      const n = applyDay(day.dayOrder, !isLeave);
      if (n === 0) continue;
      totalHeld += n;
      if (isLeave) {
        affectedDays++;
        totalMissed += n;
      } else {
        attendedDays++;
      }
    }
  }

  for (const s of subjects) s.pctAfter = pct(s.attendedAfter, s.conductedAfter);

  const aB = subjects.reduce((x, s) => x + s.attendedBefore, 0);
  const cB = subjects.reduce((x, s) => x + s.conductedBefore, 0);
  const aA = subjects.reduce((x, s) => x + s.attendedAfter, 0);
  const cA = subjects.reduce((x, s) => x + s.conductedAfter, 0);

  return {
    subjects,
    overallBefore: pct(aB, cB),
    overallAfter: pct(aA, cA),
    affectedDays,
    attendedDays,
    totalHeld,
    totalMissed,
    through,
  };
}
