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
export type ReminderKind =
  | "class"
  | "marked"
  | "risk"
  | "edge"
  | "dayorder";

/** One line in the feed. */
export type Reminder = {
  id: string;
  kind: ReminderKind;
  tone: ReminderTone;
  title: string;
  meta?: string;
};

/**
 * How long before a class it gets flagged. A constant, not a setting: asking
 * someone to choose a number before the feature does anything is a worse
 * default than simply picking the sensible one.
 */
export const CLASS_LEAD_MIN = 30;

/** What attendance looked like last time, so a change can be spotted. */
export type SeenAttendance = Record<string, { attended: number; conducted: number }>;

export type AttendanceChange = {
  title: string;
  /** Classes newly recorded. */
  held: number;
  /** How many of those the student was present for. */
  present: number;
  percentage: number;
};

const seenKey = (reg: string) => `skipp.attnSeen.${reg}`;
const rowKey = (code: string, category: string) => `${code}::${category}`;

export function loadSeenAttendance(reg: string): SeenAttendance {
  try {
    const raw = localStorage.getItem(seenKey(reg));
    return raw ? (JSON.parse(raw) as SeenAttendance) : {};
  } catch {
    return {};
  }
}

export function saveSeenAttendance(
  reg: string | null,
  a: Attendance | null,
): void {
  if (!reg || !a) return;
  try {
    const map: SeenAttendance = {};
    for (const s of a.subjects) {
      map[rowKey(s.code, s.category)] = { attended: s.attended, conducted: s.conducted };
    }
    localStorage.setItem(seenKey(reg), JSON.stringify(map));
  } catch {
    /* non-fatal */
  }
}

/**
 * What the portal recorded since the last snapshot. A subject with no previous
 * reading is NOT a change: on a first sign-in every subject would otherwise
 * announce itself, which is noise rather than news.
 */
export function diffAttendance(
  current: Attendance | null,
  seen: SeenAttendance,
): AttendanceChange[] {
  if (!current) return [];
  const out: AttendanceChange[] = [];
  for (const s of current.subjects) {
    const was = seen[rowKey(s.code, s.category)];
    if (!was) continue;
    const held = s.conducted - was.conducted;
    if (held <= 0) continue;
    out.push({
      title: s.title || s.code,
      held,
      present: s.attended - was.attended,
      percentage: s.percentage,
    });
  }
  return out;
}

// ---- the feed --------------------------------------------------------------

const ORDER: Record<ReminderTone, number> = {
  danger: 0,
  warning: 1,
  muted: 2,
  success: 3,
};

const short = (t: string) => (t.length > 30 ? `${t.slice(0, 28).trimEnd()}…` : t);

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
  /** What the portal recorded since the last snapshot. */
  changes: AttendanceChange[];
}): Reminder[] {
  const threshold = opts.threshold ?? 75;
  const out: Reminder[] = [];

  // 1. A class starting soon. Always on, always the same lead time.
  if (opts.nowMin !== null) {
    const now = opts.nowMin;
    const soon = opts.todayClasses.find(
      (c) => c.startMin > now && c.startMin - now <= CLASS_LEAD_MIN,
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

  // 2. What the portal marked since the last look. The thing a student most
  //    wants to know and cannot get from the portal without going and checking.
  for (const c of opts.changes) {
    const missed = c.held - c.present;
    out.push({
      id: `marked-${c.title}`,
      kind: "marked",
      tone: missed > 0 ? "warning" : "success",
      title:
        missed > 0
          ? `${short(c.title)}: ${missed} of ${c.held} marked absent`
          : `${short(c.title)}: ${c.held} marked present`,
      meta: `Now at ${c.percentage.toFixed(0)}%`,
    });
  }

  // 3. Attendance standing, the reason the app exists.
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
