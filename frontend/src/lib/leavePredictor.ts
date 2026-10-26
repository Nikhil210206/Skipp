// Attendance & leave projection engine aligned with getratiod.lol (Ratio'd SRM)
//
// Calculates the exact impact of leaves and OD/ML on attendance percentage and margins:
// 1. Accurately counts lab & theory durations (e.g. 100min lab = 2 classes, 150min lab = 3 classes).
// 2. Matches enrolled subjects to timetable periods with code & category fuzzy resolution.
// 3. Supports both 'leave' (missed classes) and 'od' (on-duty / medical leave excused/credited).
// 4. Calculates per-subject margins (safe: classes you can skip; risk: classes to recover).
// 5. Predicts the earliest calendar recovery date for any subject that falls below 75%.

import type { Attendance, CalendarDay, DayOrderSchedule, Subject } from "@/types";

export type PredictAction = "leave" | "od";

export type ProjectedSubject = {
  code: string;
  title: string;
  category: string;
  isPractical: boolean;
  attendedBefore: number;
  conductedBefore: number;
  pctBefore: number;
  marginBefore: number;
  labelBefore: "margin" | "recover";
  attendedAfter: number;
  conductedAfter: number;
  pctAfter: number;
  marginAfter: number;
  labelAfter: "margin" | "recover";
  isSafe: boolean; // pctAfter >= 75
  hasChanged: boolean;
  /** Classes of this subject held in the projection window. */
  held: number;
  /** Classes missed during the leave. */
  missed: number;
  /** Attendance hours credited from OD/ML. */
  odCredited: number;
  /** Earliest calendar date where attendance recovers to >= 75%, or null. */
  recoveryDate: string | null;
};

export type Projection = {
  subjects: ProjectedSubject[];
  overallBefore: number;
  overallAfter: number;
  delta: number;
  /** Days picked that actually hold scheduled classes. */
  affectedDays: number;
  /** Working days in the window attended as normal. */
  attendedDays: number;
  /** Total classes held in the simulation window. */
  totalHeld: number;
  /** Total classes missed across all subjects. */
  totalMissed: number;
  /** The last date the projection runs to, or null when nothing is picked. */
  through: string | null;
  /** Subjects that drop below 75% (Action Required). */
  atRiskSubjects: ProjectedSubject[];
  /** Subjects that remain >= 75%. */
  safeSubjects: ProjectedSubject[];
  /** True if any subject is below 75% after the projected leave. */
  hasDebarmentRisk: boolean;
};

const TARGET = 75;

export const pct = (a: number, c: number) => (c > 0 ? (a / c) * 100 : 0);

/**
 * Calculates subject margin or recovery count, matching Ratio'd (u/BS):
 * - If >= 75%: margin = floor((attended - 0.75 * conducted) / 0.75) (classes you can skip)
 * - If < 75%: recover = classes to attend in a row to reach 75%
 */
export function calculateSubjectMargin(
  attended: number,
  conducted: number,
  threshold = TARGET,
): { val: number; label: "margin" | "recover"; isSafe: boolean } {
  if (conducted <= 0) {
    return { val: 0, label: "margin", isSafe: true };
  }
  const currentPct = (attended / conducted) * 100;
  const t = threshold / 100;
  const isSafe = currentPct >= threshold;

  if (isSafe) {
    const val = Math.max(0, Math.floor((attended - t * conducted) / t + 1e-9));
    return { val, label: "margin", isSafe: true };
  }

  let recover = 0;
  while (
    conducted + recover > 0 &&
    ((attended + recover) / (conducted + recover)) * 100 < threshold
  ) {
    recover++;
  }
  return { val: recover, label: "recover", isSafe: false };
}

/**
 * Computes how many class periods a timetable slot represents.
 * Standard SRM period is 50 minutes.
 * - 50 mins = 1 class
 * - 100 mins (lab double slot) = 2 classes
 * - 150 mins (lab triple slot) = 3 classes
 */
export function getSlotHours(slot: {
  start?: string;
  end?: string;
  startMin?: number;
  endMin?: number;
}): number {
  if (slot.startMin != null && slot.endMin != null && slot.endMin > slot.startMin) {
    const diff = slot.endMin - slot.startMin;
    return Math.max(1, Math.round(diff / 50));
  }
  if (slot.start && slot.end) {
    const parseMins = (t: string) => {
      const parts = t.replace(/[^\d:]/g, "").split(":").map(Number);
      if (isNaN(parts[0]) || isNaN(parts[1])) return 0;
      let h = parts[0];
      if (h < 7) h += 12; // PM adjustment (e.g. 01:15 -> 13:15)
      return h * 60 + parts[1];
    };
    const s = parseMins(slot.start);
    const e = parseMins(slot.end);
    const diff = e - s;
    if (diff > 0) return Math.max(1, Math.round(diff / 50));
  }
  return 1;
}

function cleanStr(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Matches a timetable class to an attendance subject row.
 * Respects Theory vs Practical split for courses that have both.
 */
function findMatchingSubject(
  code: string,
  title: string,
  isLab: boolean,
  subjects: ProjectedSubject[],
): ProjectedSubject | null {
  const normCode = cleanStr(code);
  const normTitle = cleanStr(title);

  // 1. Exact match on cleaned code AND lab status
  let match = subjects.find(
    (s) => cleanStr(s.code) === normCode && s.isPractical === isLab,
  );
  if (match) return match;

  // 2. Substring/prefix match on code AND lab status
  match = subjects.find((s) => {
    const sc = cleanStr(s.code);
    return (sc.includes(normCode) || normCode.includes(sc)) && s.isPractical === isLab;
  });
  if (match) return match;

  // 3. Cleaned title match AND lab status
  if (normTitle.length > 3) {
    match = subjects.find((s) => {
      const st = cleanStr(s.title);
      return (st === normTitle || st.includes(normTitle) || normTitle.includes(st)) && s.isPractical === isLab;
    });
    if (match) return match;
  }

  // 4. Fallback: match by code alone if only one candidate exists
  const byCode = subjects.filter((s) => {
    const sc = cleanStr(s.code);
    return sc === normCode || sc.includes(normCode) || normCode.includes(sc);
  });
  if (byCode.length === 1) return byCode[0];

  // 5. Fallback: match by title alone
  if (normTitle.length > 3) {
    const byTitle = subjects.filter((s) => {
      const st = cleanStr(s.title);
      return st === normTitle || st.includes(normTitle) || normTitle.includes(st);
    });
    if (byTitle.length === 1) return byTitle[0];
  }

  return byCode[0] ?? null;
}

/**
 * Finds the earliest upcoming calendar date where this subject recovers to >= 75%
 * by attending scheduled classes after the leave.
 */
function findRecoveryDate(
  subject: ProjectedSubject,
  afterDate: string,
  calendar: CalendarDay[],
  dayOrders: DayOrderSchedule[],
): string | null {
  if (subject.isSafe) return null;

  let a = subject.attendedAfter;
  let c = subject.conductedAfter;

  const sortedFuture = calendar
    .filter((d) => d.date > afterDate && d.dayOrder != null && !d.isHoliday)
    .sort((x, y) => x.date.localeCompare(y.date));

  for (const day of sortedFuture) {
    const sched = dayOrders.find((d) => d.dayOrder === day.dayOrder);
    if (!sched?.classes?.length) continue;

    for (const cl of sched.classes) {
      const match = findMatchingSubject(cl.code, cl.title, cl.isLab, [subject]);
      if (match) {
        const hours = getSlotHours(cl);
        a += hours;
        c += hours;
        if (c > 0 && (a / c) * 100 >= TARGET) {
          return day.date;
        }
      }
    }
  }
  return null;
}

export function projectAttendance(opts: {
  attendance: Attendance;
  calendar: CalendarDay[];
  /** Day orders without optional courses. */
  dayOrders: DayOrderSchedule[];
  /** Dates to take off, as YYYY-MM-DD. */
  leaveDates?: string[];
  /** Optional per-date action map: { '2026-10-27': 'leave' | 'od' } */
  dateActions?: Record<string, PredictAction>;
  /** Default action for dates in leaveDates. Defaults to 'leave'. */
  defaultAction?: PredictAction;
  /** Today, as YYYY-MM-DD. */
  today?: string;
}): Projection {
  const { attendance, calendar, dayOrders, leaveDates = [], dateActions = {} } = opts;
  const now = new Date();
  const today =
    opts.today ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

  // Build the complete action map
  const actionMap: Record<string, PredictAction> = { ...dateActions };
  const defaultAct = opts.defaultAction ?? "leave";
  for (const d of leaveDates) {
    if (!actionMap[d]) actionMap[d] = defaultAct;
  }

  // Initialize projected subjects
  const subjects: ProjectedSubject[] = (attendance.subjects ?? []).map((s) => {
    const isLab =
      /practical|lab/i.test(s.category || "") ||
      (s.slot || "").toUpperCase().startsWith("P") ||
      (s.slot || "").toUpperCase().startsWith("L") ||
      s.slot === "LAB";
    const mBefore = calculateSubjectMargin(s.attended, s.conducted, TARGET);
    return {
      code: s.code,
      title: s.title || s.code,
      category: s.category || (isLab ? "Practical" : "Theory"),
      isPractical: isLab,
      attendedBefore: s.attended,
      conductedBefore: s.conducted,
      pctBefore: pct(s.attended, s.conducted),
      marginBefore: mBefore.val,
      labelBefore: mBefore.label,
      attendedAfter: s.attended,
      conductedAfter: s.conducted,
      pctAfter: pct(s.attended, s.conducted),
      marginAfter: mBefore.val,
      labelAfter: mBefore.label,
      isSafe: mBefore.isSafe,
      hasChanged: false,
      held: 0,
      missed: 0,
      odCredited: 0,
      recoveryDate: null,
    };
  });

  const selectedEntries = Object.entries(actionMap);
  if (selectedEntries.length === 0) {
    const aB = subjects.reduce((x, s) => x + s.attendedBefore, 0);
    const cB = subjects.reduce((x, s) => x + s.conductedBefore, 0);
    return {
      subjects,
      overallBefore: pct(aB, cB),
      overallAfter: pct(aB, cB),
      delta: 0,
      affectedDays: 0,
      attendedDays: 0,
      totalHeld: 0,
      totalMissed: 0,
      through: null,
      atRiskSubjects: subjects.filter((s) => !s.isSafe),
      safeSubjects: subjects.filter((s) => s.isSafe),
      hasDebarmentRisk: subjects.some((s) => !s.isSafe),
    };
  }

  // Handle Past OD/ML Credits (Ratio'd logic: past absences credited back)
  for (const [date, act] of selectedEntries) {
    if (act !== "od" || date >= today) continue;
    const calDay = calendar.find((c) => c.date === date);
    if (!calDay || calDay.dayOrder == null || calDay.isHoliday) continue;
    const sched = dayOrders.find((d) => d.dayOrder === calDay.dayOrder);
    for (const cl of sched?.classes ?? []) {
      const match = findMatchingSubject(cl.code, cl.title, cl.isLab, subjects);
      if (match) {
        const hours = getSlotHours(cl);
        match.odCredited += hours;
      }
    }
  }

  // Apply past OD credits (capped at current absences)
  for (const s of subjects) {
    if (s.odCredited > 0) {
      const absent = Math.max(0, s.conductedBefore - s.attendedBefore);
      const cred = Math.min(s.odCredited, absent);
      s.attendedAfter += cred;
    }
  }

  // Future projection window:
  // Starts today (or tomorrow if today is past / marked) through the latest selected date.
  const futureEntries = selectedEntries.filter(([d]) => d >= today);
  const futureDates = futureEntries.map(([d]) => d).sort();
  const through = futureDates.length > 0 ? futureDates[futureDates.length - 1] : null;

  let affectedDays = 0;
  let attendedDays = 0;
  let totalHeld = 0;
  let totalMissed = 0;

  if (through) {
    for (const day of calendar) {
      if (day.date < today || day.date > through) continue;
      if (day.dayOrder == null || day.isHoliday) continue;

      const sched = dayOrders.find((d) => d.dayOrder === day.dayOrder);
      if (!sched?.classes?.length) continue;

      const act = actionMap[day.date]; // 'leave' | 'od' | undefined
      let dayHeld = 0;
      let isLeaveDay = act === "leave";

      for (const cl of sched.classes) {
        const match = findMatchingSubject(cl.code, cl.title, cl.isLab, subjects);
        if (!match) continue;

        const hours = getSlotHours(cl);
        dayHeld += hours;
        match.held += hours;
        match.conductedAfter += hours;

        if (act === "leave") {
          // Missed
          match.missed += hours;
        } else {
          // Attended (regular day in between, or future OD excused)
          match.attendedAfter += hours;
        }
      }

      if (dayHeld > 0) {
        totalHeld += dayHeld;
        if (isLeaveDay) {
          affectedDays++;
          totalMissed += dayHeld;
        } else {
          attendedDays++;
        }
      }
    }
  }

  // Recompute percentages, margins, and changes for every subject
  for (const s of subjects) {
    s.pctAfter = pct(s.attendedAfter, s.conductedAfter);
    const mAfter = calculateSubjectMargin(s.attendedAfter, s.conductedAfter, TARGET);
    s.marginAfter = mAfter.val;
    s.labelAfter = mAfter.label;
    s.isSafe = mAfter.isSafe;
    s.hasChanged =
      s.marginAfter !== s.marginBefore ||
      s.labelAfter !== s.labelBefore ||
      s.missed > 0 ||
      s.odCredited > 0;

    if (!s.isSafe && through) {
      s.recoveryDate = findRecoveryDate(s, through, calendar, dayOrders);
    }
  }

  const aB = subjects.reduce((x, s) => x + s.attendedBefore, 0);
  const cB = subjects.reduce((x, s) => x + s.conductedBefore, 0);
  const aA = subjects.reduce((x, s) => x + s.attendedAfter, 0);
  const cA = subjects.reduce((x, s) => x + s.conductedAfter, 0);

  const overallBefore = pct(aB, cB);
  const overallAfter = pct(aA, cA);
  const delta = overallAfter - overallBefore;

  // Split into At-Risk (Action Required) and Safe subjects, matching Ratio'd layout
  const atRiskSubjects = subjects
    .filter((s) => !s.isSafe)
    .sort((a, b) => b.marginAfter - a.marginAfter);

  const safeSubjects = subjects
    .filter((s) => s.isSafe)
    .sort((a, b) => {
      // Affected subjects first, then lowest margin
      if (a.hasChanged !== b.hasChanged) return a.hasChanged ? -1 : 1;
      return a.marginAfter - b.marginAfter;
    });

  return {
    subjects,
    overallBefore,
    overallAfter,
    delta,
    affectedDays,
    attendedDays,
    totalHeld,
    totalMissed,
    through,
    atRiskSubjects,
    safeSubjects,
    hasDebarmentRisk: atRiskSubjects.length > 0,
  };
}
