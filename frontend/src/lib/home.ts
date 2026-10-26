"use client";

import { useSession } from "@/context/SessionContext";
import { buildReminders } from "./reminders";
import { holidayName, termHolidays, type Holiday } from "./holidays";
import {
  daySchedule,
  focusDay,
  holidayToday,
  mergeRuns,
  nowMinutes,
  prettyDate,
  scheduleFor,
  todayISO,
  type ScheduleItem,
} from "./schedule";

/**
 * Everything Home shows, derived once from the snapshot.
 *
 * It lives here rather than in the page because three versions of Home read
 * it: the default cover, and the Register and Ticket looks, which compose the
 * same facts differently. One derivation means the three can never disagree
 * about which class is next.
 */
export function useHomeData() {
  const {
    timetable,
    attendance,
    attendanceState,
    customClasses,
    attendingDayOrders,
    displayName,
    attendanceChanges,
  } = useSession();

  const holiday = timetable ? holidayToday(timetable.calendar) : null;
  const focus = timetable ? focusDay(timetable, attendingDayOrders) : null;
  // The filtered grid, so optional courses never reach the day's class list.
  const schedule = scheduleFor(attendingDayOrders, focus?.dayOrder ?? null);
  // Merged FIRST. A lab is two or three consecutive periods of one course, and
  // a student thinks of it as one class: if the hero is picked from unmerged
  // periods, the rest of the same lab reappears in the list below it, and the
  // countdown runs to the end of period one rather than the end of the lab.
  const classes = mergeRuns(
    daySchedule(schedule?.classes ?? [], customClasses, focus?.dayOrder ?? null),
  );

  const cover = buildCover(classes, focus, holiday);
  const later = cover.hero ? classes.slice(classes.indexOf(cover.hero) + 1) : classes;

  const overall = attendance?.overallPercentage ?? 0;
  const belowTarget =
    attendance?.subjects.filter((s) => s.conducted > 0 && !s.isSafe).length ?? 0;

  // Everything that wants attention right now, derived from the snapshot
  // already on the device plus the student's own reminders.
  const today = todayISO();
  const isTodayFocused = focus?.label === "TODAY";
  const feed = buildReminders({
    attendance,
    attendanceReady: attendanceState === "ready",
    todayClasses: isTodayFocused ? classes : [],
    nowMin: isTodayFocused ? nowMinutes() : null,
    todayISO: today,
    // Strictly AFTER today: `nextWorkingDay` returns today itself when today
    // is a working day, which made the note describe the day you are already
    // standing in.
    nextWorking:
      timetable?.calendar.find((d) => d.date > today && d.dayOrder != null) ?? null,
    changes: attendanceChanges,
  });

  // The next break you come back from. A holiday after the last working day is
  // not a break, it is the end of term, and only the first holiday in a run
  // gets to announce it.
  const nextBreak: Holiday | null = timetable
    ? (termHolidays(timetable.calendar, today).find((h) => !h.past && h.runLead && h.resumes) ??
      null)
    : null;

  return {
    attendance,
    attendanceState,
    displayName,
    focus,
    classes,
    cover,
    later,
    overall,
    belowTarget,
    feed,
    today,
    nextBreak,
  };
}

export type HomeData = ReturnType<typeof useHomeData>;

/**
 * Time-aware and deliberately deterministic: the same hour always gives the
 * same word. Copy that reshuffles on every render is a novelty the first time
 * and noise every time after.
 */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Late one";
}

export type Cover = {
  label: string;
  title: string;
  meta: string;
  /** Epoch ms the countdown runs to, or null when there is nothing to count to. */
  targetMs: number | null;
  hero: ScheduleItem | null;
  thenLabel: string;
  /** Why there are no classes today, when that is the reason for the wait. */
  note: string | null;
};

/**
 * Works out what the cover is counting down to: the end of the class you are
 * sitting in, the start of the next one, or the return to classes after a break.
 */
export function buildCover(
  classes: ScheduleItem[],
  focus: ReturnType<typeof focusDay>,
  holiday: { event: string | null } | null,
): Cover {
  const empty: Cover = {
    label: "Nothing scheduled",
    title: "You are free.",
    meta: "No classes on your calendar.",
    targetMs: null,
    hero: null,
    thenLabel: "Later",
    note: null,
  };
  if (!focus || classes.length === 0) return empty;

  const at = (iso: string, minutes: number) =>
    new Date(`${iso}T00:00:00`).getTime() + minutes * 60_000;

  const isToday = focus.label === "TODAY";
  const now = nowMinutes();

  if (isToday) {
    const running = classes.find((c) => c.startMin <= now && now < c.endMin);
    if (running) {
      return {
        label: "In class · ends in",
        title: running.title,
        meta: [`until ${running.end}`, running.room].filter(Boolean).join(" · "),
        targetMs: at(focus.date, running.endMin),
        hero: running,
        thenLabel: "Then",
        note: null,
      };
    }
    const next = classes.find((c) => c.startMin > now);
    if (next) {
      return {
        label: "Starts in",
        title: next.title,
        meta: [`${next.start} to ${next.end}`, next.room].filter(Boolean).join(" · "),
        targetMs: at(focus.date, next.startMin),
        hero: next,
        thenLabel: "Then",
        note: null,
      };
    }
  }

  const first = classes[0];
  return {
    label: holiday ? "Classes resume in" : "Next class in",
    title: first.title,
    meta: [prettyDate(focus.date), `${first.start} to ${first.end}`, first.room]
      .filter(Boolean)
      .join(" · "),
    targetMs: at(focus.date, first.startMin),
    hero: first,
    thenLabel: `Rest of ${focus.weekday}`,
    note: holiday
      ? `Today is ${holiday.event ? holidayName(holiday.event) : "a holiday"}`
      : null,
  };
}
