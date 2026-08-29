// Days off, read out of the academic planner.
//
// The planner marks a holiday with a name and no day order, exactly like it
// marks a Saturday with no name and no day order. So to a student scanning the
// term the two are indistinguishable, and the question they actually have,
// "when do I next get a proper break", is not answerable from the grid at all.
//
// What makes a holiday worth anything is the RUN it sits in: the same holiday
// is one day off on a Wednesday and three on a Friday, and two holidays landing
// back to back are one four-day break rather than two days off. That has to be
// counted off the calendar, because only the calendar knows which days around
// it hold classes.

import type { CalendarDay } from "@/types";
import { isSaturdayClassEntry, teachingPeriod } from "@/lib/saturday";

export type Holiday = {
  date: string;
  /** The event text with the portal's shouted " - Holiday" suffix taken off. */
  name: string;
  weekday: string;
  /** Consecutive days with no classes around it, this one included. */
  run: number;
  runStart: string;
  runEnd: string;
  /** The first named holiday in the run, i.e. the one that gets to claim it. */
  runLead: boolean;
  /** Whether classes actually start again afterwards. */
  resumes: boolean;
  /**
   * Whether it lands on a day this student had off anyway.
   *
   * Not simply "is it a weekend": a student who sits Saturday classes GAINS a
   * real day when a festival falls on a Saturday, and telling them it "falls
   * on a weekend" would be telling them they gained nothing. Sunday is always
   * free; Saturday depends on the student.
   */
  onFreeWeekend: boolean;
  past: boolean;
};

/**
 * What the portal writes, and what students actually call it.
 *
 * Keyed on the cleaned, lowercased name. This is presentation only: the planner
 * text is left untouched everywhere it is parsed, so a spelling change here can
 * never affect which dates are days off.
 */
const CALLED: Record<string, string> = {
  deepavali: "Diwali",
};

/** The portal shouts the category at the end of every name. */
export function holidayName(event: string): string {
  const clean = event.replace(/\s*-\s*Holiday$/i, "").trim();
  return CALLED[clean.toLowerCase()] ?? clean;
}

const isNextDay = (a: string, b: string) =>
  Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`) === 86400000;

/**
 * Every named holiday in the term, in date order, each carrying the break it
 * belongs to.
 */
export function termHolidays(
  cal: CalendarDay[],
  today: string,
  /**
   * Set when the student sits their own Saturday classes.
   *
   * **This is the one place Saturday is allowed to reach outside its own
   * store, and it is deliberate rather than an oversight.** A break is only a
   * break if you do not have to come back into the middle of it, so for a
   * student with a Saturday timetable, Gandhi Jayanthi on a Friday is one day
   * off and not three. The dependency runs one way (holidays asks about
   * Saturday, never the reverse) and reaches a displayed figure only: nothing
   * here touches attendance, the day-order grid or the leave planner.
   *
   * Left off, every Saturday is a day off exactly as before, which is the
   * truth for a student who has added no Saturday classes.
   */
  opts: { saturdaysAreClassDays?: boolean } = {},
): Holiday[] {
  const days = [...cal].sort((a, b) => a.date.localeCompare(b.date));
  const out: Holiday[] = [];
  const satWorks = opts.saturdaysAreClassDays ?? false;
  // Computed once. Saturdays outside the teaching period hold no classes,
  // which is what stops Christmas reading as though the term resumed on the
  // 26th, three weeks after the last working day.
  const term = teachingPeriod(cal);

  /**
   * Does this student have class on this day?
   *
   * **`dayOrder != null` is not enough once Saturdays are in play**, and both
   * halves of that matter. The run walk has to STOP at a working Saturday, or
   * it swallows one and reports a break that is really two. And `resumes` has
   * to count it as a return to class, or a Friday holiday followed by a
   * working Saturday reads as "after the term", because the Saturday carries
   * no day order and the old test saw only that.
   */
  const isClassDay = (d: CalendarDay) =>
    d.dayOrder != null || (satWorks && isSaturdayClassEntry(d, term));

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d.isHoliday || !d.event) continue;

    // A break still to come is described by what is LEFT of it: if today is the
    // Sunday before a Monday holiday, two days remain, not three. A break
    // already gone is described whole, since there is nothing left to clamp.
    const floor = d.date >= today ? today : "";
    let a = i;
    while (
      a > 0 &&
      days[a - 1].date >= floor &&
      !isClassDay(days[a - 1]) &&
      isNextDay(days[a - 1].date, days[a].date)
    )
      a--;

    let b = i;
    while (
      b < days.length - 1 &&
      !isClassDay(days[b + 1]) &&
      isNextDay(days[b].date, days[b + 1].date)
    )
      b++;

    // Two holidays can sit back to back (Ayutha Pooja then Vijaya Dasami) and
    // both are in the same block of days off. Only the first says how long it
    // is, or the same four days get announced twice in a row.
    let runLead = true;
    for (let j = a; j < i; j++) if (days[j].isHoliday) runLead = false;

    // A run only means anything if you have to come back from it. Christmas
    // sits three weeks past the last working day, so counting its block of
    // dayOrder-less days called it "24 days off", which is true of the grid and
    // nonsense to a student: the term was already over.
    const next = days[b + 1];

    out.push({
      date: d.date,
      name: holidayName(d.event),
      weekday: d.weekday,
      run: b - a + 1,
      runStart: days[a].date,
      runEnd: days[b].date,
      runLead,
      resumes: Boolean(next && isClassDay(next)),
      // Sunday is free for everybody. A Saturday is free only for a student
      // who does not sit classes on it.
      onFreeWeekend: d.weekday === "Sun" || (d.weekday === "Sat" && !satWorks),
      past: d.date < today,
    });
  }
  return out;
}

/** Whether this one is worth planning around: a real break, still to come. */
export const isLongBreak = (h: Holiday) =>
  !h.past && h.resumes && h.runLead && h.run >= 3;

// ---------- display ----------------------------------------------

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Aug 15" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

/** "Sat, Aug 15" */
export function dayAndDate(weekday: string, iso: string): string {
  return `${weekday}, ${shortDate(iso)}`;
}

/**
 * "Sep 4 to 6", or "Oct 31 to Nov 2" when it crosses a month.
 *
 * The month is only repeated when it changes, because the whole point of the
 * line is to be read at a glance beside a figure.
 */
export function dateRange(startISO: string, endISO: string): string {
  const [, sm, sd] = startISO.split("-").map(Number);
  const [, em, ed] = endISO.split("-").map(Number);
  const start = `${MONTH_NAMES[sm - 1].slice(0, 3)} ${sd}`;
  if (sm === em) return `${start} to ${ed}`;
  return `${start} to ${MONTH_NAMES[em - 1].slice(0, 3)} ${ed}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000,
  );
}

/** "tomorrow", "in 5 days", "in 3 weeks". */
export function daysAway(from: string, to: string): string {
  const days = daysBetween(from, to);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "in a week" : `in ${weeks} weeks`;
}

/**
 * What the right-hand side of a holiday row says, or null for the ordinary
 * case of a single day in the middle of a week.
 *
 * Only one of these can be true at a time, and the order matters: a holiday
 * past the last working day is not a long weekend however many blank days
 * follow it, and a run beats the fact that it happens to start on a Saturday.
 */
export function holidayNote(
  h: Holiday,
): { text: string; strong: boolean; range?: string } | null {
  if (h.past) return null;
  if (!h.resumes) return { text: "after the term", strong: false };
  if (h.run >= 3 && h.runLead)
    return {
      // The dates are the useful half. A run does not have to start on the
      // holiday itself: Vinayakar Chathurthi is a Monday, so the break really
      // begins on the Saturday before it, and no amount of staring at "3 days
      // off" tells you that.
      text: `${h.run} days off`,
      strong: true,
      range: dateRange(h.runStart, h.runEnd),
    };
  // Asks whether the student actually had the day off, not what the day is
  // called. A festival on a Saturday is a real day gained by anyone who sits
  // Saturday classes, and saying it "falls on a weekend" would deny them it.
  if (h.onFreeWeekend)
    return { text: `falls on a ${fullWeekday(h.weekday)}`, strong: false };
  return null;
}

export function fullWeekday(abbr: string): string {
  const map: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
  };
  return map[abbr] ?? abbr;
}
