// Build the in-app alert feed from the current snapshot. (True push
// notifications need a server + push service — a deploy-time enhancement; this
// is the on-device surface that drives them.)

import type { Attendance, CalendarDay } from "@/types";
import type { ScheduleItem } from "./schedule";

export type AlertTone = "danger" | "warning" | "success" | "muted";
export type Alert = { id: string; icon: string; title: string; tone: AlertTone };

const ORDER: Record<AlertTone, number> = {
  danger: 0,
  warning: 1,
  muted: 2,
  success: 3,
};

export function buildAlerts(opts: {
  attendance: Attendance | null;
  attendanceReady: boolean;
  threshold?: number;
  nextClass: ScheduleItem | null;
  nextClassLabel: string; // "today" | weekday
  holiday: CalendarDay | null;
  daysToHoliday: number | null;
}): Alert[] {
  const threshold = opts.threshold ?? 75;
  const alerts: Alert[] = [];

  if (opts.attendanceReady && opts.attendance) {
    for (const s of opts.attendance.subjects) {
      if (s.conducted === 0) continue;
      if (!s.isSafe) {
        alerts.push({
          id: `low-${s.code}`,
          icon: "🚨",
          tone: "danger",
          title: `${short(s.title || s.code)} at ${s.percentage.toFixed(0)}% — attend ${s.mustAttend} to fix`,
        });
      } else if (s.canSkip === 0) {
        alerts.push({
          id: `edge-${s.code}`,
          icon: "⚡",
          tone: "warning",
          title: `${short(s.title || s.code)} is right on ${threshold}% — don't bunk it`,
        });
      }
    }
  }

  if (opts.nextClass) {
    const c = opts.nextClass;
    alerts.push({
      id: "next",
      icon: "📚",
      tone: "muted",
      title: `${opts.nextClassLabel === "today" ? "Next up" : `${opts.nextClassLabel}'s first`}: ${c.abbrev} at ${c.start}${c.room ? ` · ${c.room}` : ""}`,
    });
  }

  if (opts.holiday && opts.daysToHoliday != null) {
    const name = opts.holiday.event?.replace(/ - Holiday$/i, "") ?? "Holiday";
    const when =
      opts.daysToHoliday === 0
        ? "today 🎉"
        : `in ${opts.daysToHoliday} day${opts.daysToHoliday === 1 ? "" : "s"}`;
    alerts.push({ id: "holiday", icon: "🎉", tone: "success", title: `${name} ${when}` });
  }

  const hasRisk = alerts.some((a) => a.tone === "danger" || a.tone === "warning");
  if (opts.attendanceReady && !hasRisk) {
    alerts.unshift({
      id: "safe",
      icon: "✅",
      tone: "success",
      title: "All subjects safe — bunk freely",
    });
  }

  return alerts.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

function short(t: string): string {
  return t.length > 26 ? t.slice(0, 24).trimEnd() + "…" : t;
}
