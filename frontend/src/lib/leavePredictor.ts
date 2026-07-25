// Project attendance forward from planned leave / attending / OD-ML days.
// For each selected date we look up its day order, then the classes on that day
// order per subject, and apply the impact:
//   leave     → class conducted but missed        (conducted +1)
//   attending → class conducted and attended       (attended +1, conducted +1)
//   od-ml     → condoned (counted present)          (attended +1, conducted +1)

import type { Attendance, CalendarDay, DayOrderSchedule } from "@/types";

export type DayKind = "leave" | "attending" | "odml";

export type ProjectedSubject = {
  code: string;
  title: string;
  attendedBefore: number;
  conductedBefore: number;
  attendedAfter: number;
  conductedAfter: number;
  pctBefore: number;
  pctAfter: number;
};

export type Projection = {
  subjects: ProjectedSubject[];
  overallBefore: number;
  overallAfter: number;
  affectedDays: number;
};

const pct = (a: number, c: number) => (c > 0 ? (a / c) * 100 : 0);

// A course can have separate Theory + Practical attendance rows sharing one
// code, so we key by code + lab-ness: theory periods (slots A-G) hit the theory
// row, lab periods (P##/L##) hit the practical row.
const keyOf = (code: string, isLab: boolean) => `${code}::${isLab ? "lab" : "th"}`;

/** Count of class periods per (code, lab-ness) on a given day order. */
function classesByKey(
  dayOrders: DayOrderSchedule[],
  dayOrder: number | null,
): Map<string, number> {
  const m = new Map<string, number>();
  if (dayOrder == null) return m;
  const sched = dayOrders.find((d) => d.dayOrder === dayOrder);
  for (const c of sched?.classes ?? []) {
    const k = keyOf(c.code, c.isLab);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function projectAttendance(opts: {
  attendance: Attendance;
  calendar: CalendarDay[];
  dayOrders: DayOrderSchedule[];
  selections: Record<string, DayKind>;
}): Projection {
  const { attendance, calendar, dayOrders, selections } = opts;
  const dateToDO = new Map(calendar.map((d) => [d.date, d.dayOrder]));

  const subjects: ProjectedSubject[] = [];
  const byKey = new Map<string, ProjectedSubject>();
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
    };
    subjects.push(ps);
    const isLab = /practical|lab/i.test(s.category) || s.slot === "LAB";
    byKey.set(keyOf(s.code, isLab), ps);
  }

  let affectedDays = 0;
  for (const [date, kind] of Object.entries(selections)) {
    const counts = classesByKey(dayOrders, dateToDO.get(date) ?? null);
    if (counts.size === 0) continue;
    affectedDays++;
    for (const [k, n] of counts) {
      const subj = byKey.get(k);
      if (!subj) continue;
      subj.conductedAfter += n;
      if (kind !== "leave") subj.attendedAfter += n;
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
  };
}
