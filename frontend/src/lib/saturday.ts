/**
 * The student's own Saturday timetable.
 *
 * **A Saturday is NOT a day order, and nothing here may pretend otherwise.**
 * SRM's academic planner gives every Saturday of the term `dayOrder: null`
 * (checked against the real captured planner: 26 Saturdays, not one carries a
 * day order), so the portal genuinely does not publish these classes. Some
 * students sit them anyway.
 *
 * That is why this is a **separate store with a separate key**, rather than a
 * sixth entry in the day-order grid. Every piece of attendance arithmetic in
 * the app is gated on `dayOrder != null`: the leave predictor, `focusDay`, the
 * term-progress count, the long-weekend runs in `lib/holidays.ts`. Handing
 * Saturday a synthetic day order would quietly change all of them. Keeping it
 * in its own array means day-order code cannot read it even by accident, which
 * is a structural guarantee rather than a rule somebody has to remember.
 *
 * The consequence, stated plainly because it is a real limit: these classes
 * carry a name the student typed, not a course code, so **they cannot reach
 * attendance or the leave planner**. They are a timetable, not a ledger.
 *
 * On-device only, like custom classes. The backend never sees any of it.
 */

import { fmtTime, type FocusDay, type ScheduleItem } from "@/lib/schedule";
import type { CalendarDay } from "@/types";

/**
 * Which half of the Saturday this student sits.
 *
 * **THIS IS NOT THE PORTAL'S BATCH, and the two must never be crossed.**
 * `StudentInfo.batch` is the batch a student belongs to for their ordinary
 * week; the Saturday split is a different arrangement that happens to use the
 * same two numbers. Seeding one from the other looks like a helpful default
 * and is really a wrong answer presented confidently, which is worse than no
 * answer: a student would have to notice it was wrong before they could fix it.
 *
 * So it is `null` until the student says, and the sheet asks. Saturday stands
 * on its own here exactly as it does everywhere else in this file.
 */
export type SaturdayBatch = 1 | 2;

export type SaturdayClass = {
  id: string;
  startMin: number; // minutes since midnight (24h)
  endMin: number;
  title: string;
  abbrev: string;
  room: string | null;
};

export type SaturdayPlan = {
  /** Null until the student chooses. Never inferred from the portal. */
  batch: SaturdayBatch | null;
  classes: SaturdayClass[];
};

/**
 * The window each Saturday batch runs in: batch 1 the morning, batch 2 the
 * afternoon. These are the bounds a typed time is checked against, so a
 * morning student cannot file a class at 3pm and then wonder why their
 * Saturday looks wrong.
 */
export const BATCH_WINDOW: Record<SaturdayBatch, { from: number; to: number }> = {
  1: { from: 8 * 60, to: 12 * 60 }, // 08:00 to 12:00
  2: { from: 13 * 60, to: 17 * 60 }, // 01:00 pm to 05:00 pm
};

export const BATCH_LABEL: Record<SaturdayBatch, string> = {
  1: "8am to 12pm",
  2: "1pm to 5pm",
};

export const EMPTY_PLAN: SaturdayPlan = { batch: null, classes: [] };

const key = (reg: string) => `skipp.saturday.${reg}`;

export function loadSaturday(reg: string): SaturdayPlan {
  try {
    const raw = localStorage.getItem(key(reg));
    if (!raw) return EMPTY_PLAN;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_PLAN;
    const p = parsed as Partial<SaturdayPlan>;
    return {
      batch: p.batch === 1 ? 1 : p.batch === 2 ? 2 : null,
      classes: Array.isArray(p.classes) ? p.classes : [],
    };
  } catch {
    return EMPTY_PLAN;
  }
}

export function saveSaturday(reg: string, plan: SaturdayPlan): void {
  try {
    localStorage.setItem(key(reg), JSON.stringify(plan));
  } catch {
    /* storage full or unavailable, non-fatal */
  }
}

export function newSaturdayId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Is this ISO date a Saturday? Parsed as a local date, never as UTC. */
export function isSaturday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 6;
}

/**
 * The next Saturday on or after `iso`, as an ISO date. Today, if today is one.
 *
 * Local dates throughout, never UTC: the whole app reads the portal's calendar
 * in local time, and a UTC round trip moves the date by one either side of
 * midnight for half the world.
 */
export function nextSaturdayISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + ((6 - dt.getDay() + 7) % 7));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Quick-fill slots offered in the sheet: one-hour periods filling the batch's
 * window.
 *
 * **Deliberately a pure function of the batch, and deliberately NOT read off
 * the weekday grid.** The unified timetable's bells (08:50, 09:45, 01:25 and
 * so on) belong to the ordinary week, and a Saturday is its own arrangement,
 * so borrowing them would be the same crossing this file exists to prevent.
 * They are a convenience only: the student can type any time in the window.
 */
export function suggestedPeriods(
  batch: SaturdayBatch,
): { startMin: number; endMin: number }[] {
  const { from, to } = BATCH_WINDOW[batch];
  const out: { startMin: number; endMin: number }[] = [];
  for (let t = from; t + 60 <= to; t += 60) {
    out.push({ startMin: t, endMin: t + 60 });
  }
  return out;
}

/** The classes in order. The store is append-only, so it has to be sorted here. */
export function sortedSaturday(plan: SaturdayPlan): SaturdayClass[] {
  return [...plan.classes].sort((a, b) => a.startMin - b.startMin);
}

/**
 * Is this date a Saturday this student sits their own classes on?
 *
 * **THE ONE PREDICATE. Every screen asks this and none may spell it out for
 * itself.** It was written inline in three places first, in three slightly
 * different ways, and they disagreed: the notification path tested
 * `today?.dayOrder == null`, which is TRUE for a date the calendar has never
 * heard of, so a student would have gone on being told a Saturday class was
 * starting every weekend for ever, months after the term ended, while Home
 * refused those same dates correctly. One of the two had to be wrong, and the
 * only durable fix is for there to be one of them.
 *
 * Five conditions:
 * - It is a Saturday.
 * - **The term knows the date.** No calendar entry, no school day.
 * - **Teaching is actually running.** Between the first and last day that
 *   carries a day order. The planner is wider than the term, so being in the
 *   calendar is not enough: see `teachingPeriod`.
 * - It is not a holiday. 15 August 2026 is a Saturday and Independence Day.
 * - The portal does not claim it. A Saturday the portal declares working
 *   carries a day order, and then its answer is the true one rather than a
 *   list the student typed months ago.
 */
export function isSaturdayClassDay(date: string, calendar: CalendarDay[]): boolean {
  const day = calendar.find((d) => d.date === date);
  return day != null && isSaturdayClassEntry(day, teachingPeriod(calendar));
}

/**
 * The first and last day the term actually teaches on, or null if it never
 * does.
 *
 * **The planner is wider than the term.** The real captured one runs 1 July to
 * 31 December while classes run 21 July to 7 December, so it carries three
 * Saturdays before teaching starts and three more after it stops, plus a
 * 24 day tail with no day orders at all. Every one of those looked like an
 * ordinary dayOrder-less Saturday, and a stored Saturday timetable was
 * therefore being applied to them: rings on the grid, a countdown on Home and
 * a notification, for classes nobody was holding because the term was over.
 *
 * Same shape of bug as the notification guard that ignored dates outside the
 * calendar, one level deeper: being IN the calendar is not the same as being
 * in the term.
 */
export function teachingPeriod(
  calendar: CalendarDay[],
): { first: string; last: string } | null {
  let first: string | null = null;
  let last: string | null = null;
  for (const d of calendar) {
    if (d.dayOrder == null) continue;
    if (first == null || d.date < first) first = d.date;
    if (last == null || d.date > last) last = d.date;
  }
  return first != null && last != null ? { first, last } : null;
}

/**
 * The same question asked of a calendar entry already in hand.
 *
 * `lib/holidays` walks the calendar day by day, so making it look each date up
 * again would be a linear search per step for an entry it is already holding.
 * This exists so that it can still ask THE predicate rather than writing the
 * three conditions out for itself, which is how they drifted the first time.
 */
export function isSaturdayClassEntry(
  day: CalendarDay,
  term: { first: string; last: string } | null,
): boolean {
  return (
    term != null &&
    day.date >= term.first &&
    day.date <= term.last &&
    isSaturday(day.date) &&
    !day.isHoliday &&
    day.dayOrder == null
  );
}

/**
 * The Saturday classes on a given date, or nothing at all.
 *
 * What any screen showing "the classes on this day" should call, so the
 * decision is taken in one place. Returns an empty list rather than null,
 * because every caller goes on to treat it as a class list either way.
 */
export function saturdayClassesOn(
  date: string,
  calendar: CalendarDay[],
  plan: SaturdayPlan,
): ScheduleItem[] {
  return isSaturdayClassDay(date, calendar) ? saturdayItems(plan) : [];
}

/**
 * Classes that no longer fit the chosen batch's window.
 *
 * Switching batch is a correction, and a student who typed a whole Saturday at
 * 2pm and then says "actually I am batch 1" now holds classes the app would
 * refuse if they were typed today. **Their data is never silently dropped or
 * rewritten**: it is handed back to them, marked, so they can fix or remove
 * it. Answering a correction by deleting work is how somebody loses a Saturday
 * they spent five minutes entering.
 */
export function outOfWindow(plan: SaturdayPlan): SaturdayClass[] {
  if (plan.batch == null) return [];
  const w = BATCH_WINDOW[plan.batch];
  return sortedSaturday(plan).filter((c) => c.startMin < w.from || c.endMin > w.to);
}

/**
 * The Saturday as rows the existing screens already know how to draw.
 *
 * A display adapter and nothing more: it borrows `ScheduleItem`'s SHAPE so
 * Home can lay a Saturday out with the same components as any other day. It
 * does not put these classes into the day-order grid, and no caller may.
 *
 * Two fields are load bearing:
 * - **`covers` is empty.** That array names the real periods a row stands for
 *   and is what the optional toggle writes keys from. A Saturday class has no
 *   period to name, and an empty list means there is nothing to key on, so the
 *   marking machinery cannot reach it even if a screen offered the control.
 * - **`isCustom` is false**, though these are user-added. Home prints "Added"
 *   for a custom row, which earns its place when one sits among the portal's
 *   own classes. On a Saturday every row is the student's own, so the badge
 *   says nothing and costs the room its place on the line.
 */
export function saturdayItems(plan: SaturdayPlan): ScheduleItem[] {
  return sortedSaturday(plan).map((c) => ({
    id: c.id,
    code: "",
    start: fmtTime(c.startMin),
    end: fmtTime(c.endMin),
    startMin: c.startMin,
    endMin: c.endMin,
    title: c.title,
    abbrev: c.abbrev,
    room: c.room,
    faculty: null,
    isLab: false,
    isCustom: false,
    isOptional: false,
    slot: null,
    covers: [],
  }));
}

/**
 * The Saturday to feature on Home, or null when something else is sooner.
 *
 * Pure, and separate from the screen, because this is the one piece of the
 * Saturday work with real conditions in it and inline logic in a component
 * cannot be tested without a browser.
 *
 * **It returns a `FocusDay` whose `dayOrder` is null and stays null.** That is
 * the whole discipline of this feature expressed in one field: the cover's
 * giant ghost numeral is gated on it, so a Saturday prints no day order, which
 * is the truth rather than a gap. Nothing downstream of here may fill it in.
 *
 * `isSaturdayClassDay` decides whether the date is one at all (in term, not a
 * holiday, not claimed by the portal). Two more conditions belong to the cover
 * specifically, and each is a bug without it:
 * - **Still to come.** Once the last class has ended the day is over, and
 *   featuring it would count down to a time already past. The same rule
 *   `focusDay` applies to an ordinary day.
 * - **Not later than the portal's own answer.** On a Tuesday with classes left,
 *   Tuesday is sooner and wins. On a Friday evening the portal says Monday and
 *   the Saturday in between is what the student actually has next, which is
 *   the case this exists for.
 */
export function saturdayFocus(opts: {
  today: string;
  nowMin: number;
  calendar: CalendarDay[];
  plan: SaturdayPlan;
  /** The date `focusDay` would feature, or null when it has nothing. */
  normalFocusDate: string | null;
}): FocusDay | null {
  const { today, nowMin, calendar, plan, normalFocusDate } = opts;
  const items = sortedSaturday(plan);
  if (items.length === 0) return null;

  const date = nextSaturdayISO(today);
  if (!isSaturdayClassDay(date, calendar)) return null;

  const lastEnd = items[items.length - 1].endMin;
  if (date === today && nowMin >= lastEnd) return null;
  if (normalFocusDate != null && normalFocusDate < date) return null;

  return {
    date,
    dayOrder: null,
    weekday: "Saturday",
    event: null,
    isHoliday: false,
    label: date === today ? "TODAY" : "UPCOMING",
  };
}
