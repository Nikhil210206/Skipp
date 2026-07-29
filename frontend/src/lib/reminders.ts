// Reminders: what needs the student's attention when they open Skipp.
//
// In-app only, by design. The web cannot schedule a notification for later on
// device (Notification Triggers never shipped, and Safari never had it), so the
// only alternatives were a server holding push tokens and schedules, which
// would break the promise in §3, or handing the job to the phone's calendar.
// This surface is honest about what it is: it tells you the moment you look.
//
// Everything here is derived from the snapshot already on the device, plus the
// student's own reminders, which never leave it.

import type { Attendance, CalendarDay } from "@/types";
import type { ScheduleItem } from "./schedule";
import { prettyDate } from "./schedule";

export type ReminderTone = "danger" | "warning" | "muted" | "success";
export type ReminderKind = "custom" | "class" | "risk" | "edge" | "dayorder";

/** One line in the feed. */
export type Reminder = {
  id: string;
  kind: ReminderKind;
  tone: ReminderTone;
  title: string;
  meta?: string;
  /** Present only for the student's own reminders, so they can be cleared. */
  userId?: string;
};

/** A reminder the student wrote. Lives on this device only. */
export type UserReminder = {
  id: string;
  text: string;
  /** "once" needs a date; "daily" fires every day at the time. */
  mode: "once" | "daily";
  /** ISO date, for "once". */
  date: string | null;
  /** Minutes since midnight. */
  atMin: number;
};

export type ReminderPrefs = {
  /** Minutes before a class to flag it, or null when switched off. */
  classOffsetMin: number | null;
};

export const DEFAULT_PREFS: ReminderPrefs = { classOffsetMin: 30 };

// ---- storage, keyed per student like the rest of the on-device prefs -------

const listKey = (reg: string) => `skipp.reminders.${reg}`;
const prefsKey = (reg: string) => `skipp.reminderPrefs.${reg}`;

export function loadReminders(reg: string): UserReminder[] {
  try {
    const raw = localStorage.getItem(listKey(reg));
    return raw ? (JSON.parse(raw) as UserReminder[]) : [];
  } catch {
    return [];
  }
}

export function saveReminders(reg: string, list: UserReminder[]): void {
  try {
    localStorage.setItem(listKey(reg), JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
}

export function loadPrefs(reg: string): ReminderPrefs {
  try {
    const raw = localStorage.getItem(prefsKey(reg));
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(reg: string, prefs: ReminderPrefs): void {
  try {
    localStorage.setItem(prefsKey(reg), JSON.stringify(prefs));
  } catch {
    /* non-fatal */
  }
}

export function newReminderId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- the feed --------------------------------------------------------------

const ORDER: Record<ReminderTone, number> = {
  danger: 0,
  warning: 1,
  muted: 2,
  success: 3,
};

const short = (t: string) => (t.length > 30 ? `${t.slice(0, 28).trimEnd()}…` : t);

const fmt = (min: number) => {
  let h = Math.floor(min / 60);
  if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};

export function buildReminders(opts: {
  attendance: Attendance | null;
  attendanceReady: boolean;
  threshold?: number;
  /** Today's classes, already filtered to the ones actually attended. */
  todayClasses: ScheduleItem[];
  /** Null when the featured day is not today. */
  nowMin: number | null;
  todayISO: string;
  /** The next working day after today, for the day-order note. */
  nextWorking: CalendarDay | null;
  user: UserReminder[];
  prefs: ReminderPrefs;
}): Reminder[] {
  const threshold = opts.threshold ?? 75;
  const out: Reminder[] = [];

  // 1. The student's own, due today and not yet past by more than an hour: a
  //    reminder you have already walked past is noise, not a reminder.
  for (const r of opts.user) {
    const forToday = r.mode === "daily" || r.date === opts.todayISO;
    if (!forToday) continue;
    const due = opts.nowMin === null ? false : opts.nowMin >= r.atMin;
    const stale = opts.nowMin !== null && opts.nowMin - r.atMin > 60;
    if (stale) continue;
    out.push({
      id: `user-${r.id}`,
      userId: r.id,
      kind: "custom",
      tone: due ? "warning" : "muted",
      title: r.text,
      meta: due ? `Was due ${fmt(r.atMin)}` : `At ${fmt(r.atMin)}`,
    });
  }

  // 2. A class starting inside the chosen window.
  const offset = opts.prefs.classOffsetMin;
  if (offset !== null && opts.nowMin !== null) {
    const soon = opts.todayClasses.find(
      (c) => c.startMin > opts.nowMin! && c.startMin - opts.nowMin! <= offset,
    );
    if (soon) {
      const mins = soon.startMin - opts.nowMin;
      out.push({
        id: `class-${soon.id}`,
        kind: "class",
        tone: "warning",
        title: `${short(soon.title)} starts in ${mins}m`,
        meta: [soon.start, soon.room].filter(Boolean).join(" · "),
      });
    }
  }

  // 3. Attendance, the reason the app exists.
  if (opts.attendanceReady && opts.attendance) {
    for (const s of opts.attendance.subjects) {
      if (s.conducted === 0) continue;
      if (!s.isSafe) {
        out.push({
          id: `risk-${s.code}-${s.category}`,
          kind: "risk",
          tone: "danger",
          title: `${short(s.title || s.code)} is at ${s.percentage.toFixed(0)}%`,
          meta: `Attend ${s.mustAttend} in a row to clear ${threshold}%`,
        });
      } else if (s.canSkip === 0) {
        out.push({
          id: `edge-${s.code}-${s.category}`,
          kind: "edge",
          tone: "warning",
          title: `${short(s.title || s.code)} is exactly on the line`,
          meta: "One more miss puts it below",
        });
      }
    }
  }

  // 4. The rotation, which is what actually catches people out: a holiday does
  //    not advance the day order, so "tomorrow is the next number" is wrong
  //    surprisingly often.
  if (opts.nextWorking?.dayOrder != null) {
    const gap = daysBetween(opts.todayISO, opts.nextWorking.date);
    out.push({
      id: "dayorder",
      kind: "dayorder",
      tone: "muted",
      title: `${gap === 1 ? "Tomorrow" : prettyDate(opts.nextWorking.date)} is day order ${opts.nextWorking.dayOrder}`,
      meta:
        gap > 1
          ? `No classes for ${gap - 1} day${gap - 1 === 1 ? "" : "s"} before that`
          : undefined,
    });
  }

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}
