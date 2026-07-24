// Day-order helpers shared by home / timetable / calendar.

import type {
  CalendarDay,
  ClassPeriod,
  CustomClass,
  DayOrderSchedule,
  Timetable,
} from "@/types";

/** A unified schedule row — an official class or a user-added custom one. */
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

function periodToItem(p: ClassPeriod, optional: string[]): ScheduleItem {
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
    isOptional: optional.includes(p.code),
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
  const off = officialClasses.map((p) => periodToItem(p, optionalCodes));
  const cust =
    dayOrder == null
      ? []
      : custom.filter((c) => c.dayOrder === dayOrder).map(customToItem);
  return [...off, ...cust].sort((a, b) => a.startMin - b.startMin);
}

/** Local date as YYYY-MM-DD (not UTC — matches the portal's local calendar). */
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
  // Fallback: the real clock is outside this term's window — feature the first
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
