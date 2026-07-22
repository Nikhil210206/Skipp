// Day-order helpers shared by home / timetable / calendar.

import type { CalendarDay, ClassPeriod, DayOrderSchedule, Timetable } from "@/types";

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

/** The next class today after `nowMin`, or null. */
export function nextClass(
  schedule: DayOrderSchedule | undefined,
  nowMin: number,
): ClassPeriod | null {
  if (!schedule) return null;
  return schedule.classes.find((c) => c.endMin > nowMin) ?? null;
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

/** Interleave classes with "break" gaps for a timeline view. */
export type TimelineItem =
  | { kind: "class"; period: ClassPeriod }
  | { kind: "break"; start: string; end: string; minutes: number };

export function timeline(classes: ClassPeriod[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  classes.forEach((c, i) => {
    if (i > 0) {
      const prev = classes[i - 1];
      const gap = c.startMin - prev.endMin;
      if (gap > 0) {
        items.push({
          kind: "break",
          start: prev.end,
          end: c.start,
          minutes: gap,
        });
      }
    }
    items.push({ kind: "class", period: c });
  });
  return items;
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
