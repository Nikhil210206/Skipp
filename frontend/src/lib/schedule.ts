// Day-order helpers shared by home / timetable / calendar.

import type {
  CalendarDay,
  ClassPeriod,
  CustomClass,
  DayOrderSchedule,
  Timetable,
} from "@/types";

/** A unified schedule row: an official class or a user-added custom one. */
export type ScheduleItem = {
  id: string;
  code: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  title: string;
  abbrev: string;
  room: string | null;
  faculty: string | null;
  isLab: boolean;
  isCustom: boolean;
  isOptional: boolean;
  slot: string | null;
};

/** Portal-style time from minutes: 490 -> "08:10", 800 -> "01:20" (no am/pm). */
export function fmtTime(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * How one optional marking is identified.
 *
 * Keyed on the day order AND the lab-ness, not on the course code alone, and
 * both halves fix a real bug:
 *
 * - **A course has separate Theory and Practical rows sharing one code.** Keyed
 *   on the code, marking the theory of 21CSC302J optional silently marked its
 *   lab too, and since the portal tracks those as two attendance rows, the
 *   projection then ignored classes the student was still attending. The same
 *   `::th` / `::lab` split the leave predictor already uses.
 * - **A course sits on more than one day order.** Marking it from one day threw
 *   it out of all of them, which is not what "I skip this Tuesday slot" means.
 *
 * The period number is deliberately NOT in the key: a lab occupying two
 * consecutive periods is one class to a student, so marking it covers both.
 */
export function optionalKey(
  dayOrder: number | null,
  code: string,
  isLab: boolean,
): string {
  return `${dayOrder ?? "?"}::${code}::${isLab ? "lab" : "th"}`;
}

/**
 * Whether this class is marked optional.
 *
 * Also honours a bare course code, which is what earlier versions stored and
 * meant "the whole course, everywhere". Those are expanded to explicit keys the
 * first time one is unmarked, so nobody's existing settings are lost on
 * upgrade.
 */
export function isMarkedOptional(
  marks: string[],
  dayOrder: number | null,
  code: string,
  isLab: boolean,
): boolean {
  if (marks.length === 0) return false;
  return marks.includes(optionalKey(dayOrder, code, isLab)) || marks.includes(code);
}

function periodToItem(
  p: ClassPeriod,
  optional: string[],
  dayOrder: number | null,
): ScheduleItem {
  return {
    id: `${p.slot}-${p.hour}`,
    code: p.code,
    start: p.start,
    end: p.end,
    startMin: p.startMin,
    endMin: p.endMin,
    title: p.title,
    abbrev: p.abbrev,
    room: p.room,
    faculty: p.faculty,
    isLab: p.isLab,
    isCustom: false,
    isOptional: isMarkedOptional(optional, dayOrder, p.code, p.isLab),
    slot: p.slot,
  };
}

function customToItem(c: CustomClass): ScheduleItem {
  return {
    id: c.id,
    code: "",
    start: fmtTime(c.startMin),
    end: fmtTime(c.endMin),
    startMin: c.startMin,
    endMin: c.endMin,
    title: c.title,
    abbrev: c.abbrev,
    room: c.room,
    faculty: c.faculty,
    isLab: false,
    isCustom: true,
    isOptional: false,
    slot: null,
  };
}

/** Official classes for a day order merged with the user's custom ones, sorted.
 * `optionalCodes` marks official courses the student flagged as optional. */
export function daySchedule(
  officialClasses: ClassPeriod[],
  custom: CustomClass[],
  dayOrder: number | null,
  optionalCodes: string[] = [],
): ScheduleItem[] {
  const off = officialClasses.map((p) => periodToItem(p, optionalCodes, dayOrder));
  const cust =
    dayOrder == null
      ? []
      : custom.filter((c) => c.dayOrder === dayOrder).map(customToItem);
  return [...off, ...cust].sort((a, b) => a.startMin - b.startMin);
}

/** Local date as YYYY-MM-DD (not UTC, to match the portal's local calendar). */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Minutes since midnight for "now". */
export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function calendarDay(
  cal: CalendarDay[],
  iso: string,
): CalendarDay | undefined {
  return cal.find((d) => d.date === iso);
}

/** Today's calendar entry if it's a holiday, else null. */
export function holidayToday(
  cal: CalendarDay[],
  iso = todayISO(),
): CalendarDay | null {
  const d = calendarDay(cal, iso);
  return d?.isHoliday ? d : null;
}

/** The next working day on/after `iso` (today itself if it's a working day). */
export function nextWorkingDay(
  cal: CalendarDay[],
  iso = todayISO(),
): CalendarDay | undefined {
  const today = calendarDay(cal, iso);
  if (today?.dayOrder != null) return today;
  return cal.find((d) => d.date > iso && d.dayOrder != null);
}

export function scheduleFor(
  dayOrders: DayOrderSchedule[],
  n: number | null,
): DayOrderSchedule | undefined {
  if (n == null) return undefined;
  return dayOrders.find((d) => d.dayOrder === n);
}

/** The next schedule item today after `nowMin`, or null. */
export function nextClass(
  items: ScheduleItem[],
  nowMin: number,
): ScheduleItem | null {
  return items.find((c) => c.endMin > nowMin) ?? null;
}

export type FocusDay = {
  date: string;
  dayOrder: number | null;
  weekday: string;
  event: string | null;
  isHoliday: boolean;
  label: "TODAY" | "UPCOMING";
};

/**
 * The day to feature on Home: today if it's a working day whose classes aren't
 * all over yet, otherwise the next upcoming working day (matches the reference
 * app's "DAY ORDER N • UPCOMING").
 */
export function focusDay(tt: Timetable, now = new Date()): FocusDay | null {
  const cal = tt.calendar;
  if (cal.length === 0) return null;
  const iso = todayISO(now);
  const today = calendarDay(cal, iso);
  const nowMin = nowMinutes(now);

  if (today?.dayOrder != null) {
    const sched = scheduleFor(tt.dayOrders, today.dayOrder);
    const lastEnd = sched?.classes.at(-1)?.endMin ?? 0;
    if (nowMin < lastEnd) {
      return { ...pick(today), label: "TODAY" };
    }
  }
  // Next working day strictly after today (today's classes are over, or today
  // is a holiday/weekend).
  const upcoming = cal.find((d) => d.date > iso && d.dayOrder != null);
  if (upcoming) return { ...pick(upcoming), label: "UPCOMING" };
  // Today is a working day whose classes are done and it's the last of the term.
  if (today?.dayOrder != null) return { ...pick(today), label: "TODAY" };
  // Fallback: the real clock is outside this term's window, so feature the first
  // working day so the app still shows a real schedule.
  const firstWorking = cal.find((d) => d.dayOrder != null);
  if (firstWorking) return { ...pick(firstWorking), label: "UPCOMING" };
  return null;
}

/** Next holiday on/after the focus date, else the first holiday of the term. */
export function upcomingHoliday(
  cal: CalendarDay[],
  fromISO: string,
): CalendarDay | undefined {
  return (
    cal.find((d) => d.isHoliday && d.date >= fromISO) ??
    cal.find((d) => d.isHoliday)
  );
}

function pick(d: CalendarDay) {
  return {
    date: d.date,
    dayOrder: d.dayOrder,
    weekday: d.weekday,
    event: d.event,
    isHoliday: d.isHoliday,
  };
}

/** Interleave schedule items with "break" gaps for a timeline view. */
export type TimelineItem =
  | { kind: "class"; item: ScheduleItem }
  | { kind: "break"; start: string; end: string; minutes: number };

export function timeline(items: ScheduleItem[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  items.forEach((c, i) => {
    if (i > 0) {
      const prev = items[i - 1];
      const gap = c.startMin - prev.endMin;
      if (gap > 0) {
        out.push({ kind: "break", start: prev.end, end: c.start, minutes: gap });
      }
    }
    out.push({ kind: "class", item: c });
  });
  return out;
}

/** Pretty date like "Wed, Jul 22". */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Labs run as two or three consecutive periods of the same course. The portal
 * lists each period separately; a student thinks of it as one class, so runs of
 * the same course are collapsed into a single entry spanning the whole block.
 */
export function mergeRuns(items: ScheduleItem[]): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    const continues =
      prev &&
      prev.code !== "" &&
      prev.code === item.code &&
      prev.isLab === item.isLab &&
      item.startMin - prev.endMin <= 10;
    if (continues) {
      out[out.length - 1] = { ...prev, end: item.end, endMin: item.endMin };
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * The day-order grid with courses the student marked optional removed.
 *
 * Anything that computes attendance must run on this, never on the raw grid:
 * a class you do not attend cannot change your attendance. The timetable screen
 * is the one exception, since it has to show optional classes in order to let
 * you unmark them.
 */
export function attendingOnly(
  dayOrders: DayOrderSchedule[],
  optionalCodes: string[],
): DayOrderSchedule[] {
  if (optionalCodes.length === 0) return dayOrders;
  return dayOrders.map((d) => ({
    ...d,
    // Matched per day order and per lab-ness, so dropping the theory on one day
    // cannot quietly drop the lab, or the same course on every other day.
    classes: d.classes.filter(
      (c) => !isMarkedOptional(optionalCodes, d.dayOrder, c.code, c.isLab),
    ),
  }));
}

/**
 * Every optional key a course occupies across the whole grid.
 *
 * Used to expand a legacy bare code into explicit keys at the moment one of
 * them is unmarked: the old value meant "everywhere", so everywhere has to be
 * written down before one can be taken away.
 */
export function optionalKeysForCourse(
  dayOrders: DayOrderSchedule[],
  code: string,
): string[] {
  const keys = new Set<string>();
  for (const d of dayOrders) {
    for (const c of d.classes) {
      if (c.code === code) keys.add(optionalKey(d.dayOrder, c.code, c.isLab));
    }
  }
  return [...keys];
}
