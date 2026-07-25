"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import {
  daySchedule,
  focusDay,
  nextClass,
  nowMinutes,
  scheduleFor,
  todayISO,
  upcomingHoliday,
  type ScheduleItem,
} from "@/lib/schedule";
import { buildAlerts } from "@/lib/alerts";

export default function DashboardPage() {
  const {
    timetable,
    attendance,
    attendanceState,
    customClasses,
    optionalCourses,
  } = useSession();

  const focus = timetable ? focusDay(timetable) : null;
  const schedule = timetable
    ? scheduleFor(timetable.dayOrders, focus?.dayOrder ?? null)
    : undefined;
  // Home features the classes you actually attend — optional ones are excluded.
  const classes = daySchedule(
    schedule?.classes ?? [],
    customClasses,
    focus?.dayOrder ?? null,
    optionalCourses,
  ).filter((c) => !c.isOptional);
  const upNext =
    focus?.label === "TODAY"
      ? nextClass(classes, nowMinutes())
      : (classes[0] ?? null);

  const nextHoliday =
    timetable && focus
      ? upcomingHoliday(timetable.calendar, focus.date)
      : undefined;
  const daysToHoliday = nextHoliday ? daysBetween(todayISO(), nextHoliday.date) : null;

  const alerts = buildAlerts({
    attendance,
    attendanceReady: attendanceState === "ready",
    threshold: attendance?.threshold,
    nextClass: upNext,
    nextClassLabel: focus?.label === "TODAY" ? "today" : (focus?.weekday ?? "next"),
    holiday: nextHoliday ?? null,
    daysToHoliday,
  }).slice(0, 4);

  return (
    <AppShell title="skipp" greeting>
      {/* Focus day header */}
      <div className="mb-3 flex items-baseline justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          {focus?.dayOrder != null ? (
            <>
              day order{" "}
              <span className="text-accent">{focus.dayOrder}</span>
              <span className="mx-1.5 text-accent">•</span>
              {focus.label.toLowerCase()}
            </>
          ) : (
            "no classes"
          )}
        </p>
      </div>

      {/* Class strip */}
      {classes.length > 0 ? (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 pb-1">
          {classes.map((c, i) => (
            <ClassChip key={`${c.slot}-${i}`} c={c} highlight={c === upNext} />
          ))}
        </div>
      ) : (
        <RestCard focus={focus} />
      )}

      {/* Up-next hero */}
      {upNext && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="mb-2 flex items-center gap-3 px-1">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
              {focus?.label === "TODAY" ? "up next" : `${focus?.weekday}'s first`}
            </span>
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-semibold tracking-widest text-text-muted">
              {upNext.room ?? ""}
            </span>
          </div>
          <h2 className="px-1 text-5xl font-extrabold leading-[0.95] tracking-tight">
            {upNext.title.length > 22
              ? upNext.title.slice(0, 20).trimEnd() + "…"
              : upNext.title.toLowerCase()}
          </h2>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-accent" />
              <span className="font-semibold">{upNext.abbrev}</span>
              <span className="text-text-muted">
                · {upNext.isCustom ? "custom" : upNext.slot}
              </span>
            </span>
            <span className="text-sm text-text-muted">
              {upNext.start} – {upNext.end}
            </span>
          </div>
        </motion.section>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="mb-4">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            alerts
          </p>
          <div className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${toneCls(a.tone)}`}
              >
                <span className="text-lg">{a.icon}</span>
                <span className="text-sm font-medium">{a.title}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Quick cards */}
      <div className="flex flex-col gap-3 pb-4">
        <QuickCard
          href="/attendance"
          tone="accent"
          title="attendance"
          value={
            attendanceState === "ready" && attendance
              ? `${attendance.overallPercentage.toFixed(1)}% overall`
              : attendanceState === "gated"
                ? "not on the portal yet"
                : attendanceState === "loading"
                  ? "loading…"
                  : "unavailable"
          }
        />
        <QuickCard href="/marks" tone="plain" title="marks" value="view internals" />
      </div>
    </AppShell>
  );
}

function toneCls(tone: "danger" | "warning" | "success" | "muted"): string {
  switch (tone) {
    case "danger":
      return "border-danger/30 bg-danger/[0.08]";
    case "warning":
      return "border-warning/30 bg-warning/[0.07]";
    case "success":
      return "border-success/25 bg-success/[0.06]";
    default:
      return "border-white/[0.06] bg-surface";
  }
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function ClassChip({ c, highlight }: { c: ScheduleItem; highlight: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex min-w-[104px] flex-col rounded-2xl border p-3 ${
        highlight
          ? "border-accent/60 bg-accent/10"
          : "border-white/[0.06] bg-surface"
      }`}
    >
      <span className="text-[10px] tracking-wider text-text-muted">
        {c.room ?? "—"}
      </span>
      <span className="mt-1 text-2xl font-extrabold tracking-tight">
        {c.abbrev}
      </span>
      <span
        className={`mt-1 text-[11px] ${highlight ? "text-accent" : "text-text-muted"}`}
      >
        {c.start} – {c.end}
      </span>
    </motion.div>
  );
}

function RestCard({
  focus,
}: {
  focus: ReturnType<typeof focusDay>;
}) {
  return (
    <div className="mb-6 rounded-2xl bg-surface p-6 text-center">
      <p className="text-3xl">🌤️</p>
      <p className="mt-2 font-semibold">
        {focus?.isHoliday ? focus.event?.replace(/ - Holiday$/i, "") : "No classes"}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {focus?.isHoliday ? "Enjoy the holiday." : "Nothing scheduled — go bunk-free."}
      </p>
    </div>
  );
}

function QuickCard({
  href,
  title,
  value,
  tone,
}: {
  href: string;
  title: string;
  value: string;
  tone: "accent" | "plain";
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors ${
        tone === "accent"
          ? "border-accent/30 bg-accent/[0.07] hover:bg-accent/10"
          : "border-white/[0.06] bg-surface hover:bg-white/[0.03]"
      }`}
    >
      <div>
        <p className="font-semibold lowercase">{title}</p>
        <p className="text-sm text-text-muted">{value}</p>
      </div>
      <span className={tone === "accent" ? "text-accent" : "text-text-muted"}>›</span>
    </Link>
  );
}
