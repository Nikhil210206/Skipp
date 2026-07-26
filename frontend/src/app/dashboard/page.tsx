"use client";

import Link from "next/link";
import { useRef } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import {
  daySchedule,
  focusDay,
  holidayToday,
  nextClass,
  nowMinutes,
  prettyDate,
  scheduleFor,
  todayISO,
  type ScheduleItem,
} from "@/lib/schedule";
import { buildAlerts } from "@/lib/alerts";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { Card, Chip, Divider, Label } from "@/components/ui";
import { IconChevronRight } from "@/components/Icons";

const THRESHOLD = 75;

export default function DashboardPage() {
  const {
    timetable,
    attendance,
    attendanceState,
    customClasses,
    optionalCourses,
    displayName,
  } = useSession();

  const holiday = timetable ? holidayToday(timetable.calendar) : null;
  const focus = timetable ? focusDay(timetable) : null;
  const schedule = timetable
    ? scheduleFor(timetable.dayOrders, focus?.dayOrder ?? null)
    : undefined;
  const classes = daySchedule(
    schedule?.classes ?? [],
    customClasses,
    focus?.dayOrder ?? null,
    optionalCourses,
  ).filter((c) => !c.isOptional);

  const isToday = focus?.label === "TODAY";
  const upNext = isToday ? nextClass(classes, nowMinutes()) : (classes[0] ?? null);
  const remaining = upNext ? classes.slice(classes.indexOf(upNext)) : classes;

  const overallPct = attendance?.overallPercentage ?? 0;
  const atRisk =
    attendance?.subjects.filter((s) => s.conducted > 0 && !s.isSafe).length ?? 0;

  // Only surface alerts that ask something of the student.
  const alerts = buildAlerts({
    attendance,
    attendanceReady: attendanceState === "ready",
    threshold: attendance?.threshold,
    nextClass: null,
    nextClassLabel: "today",
    holiday: null,
    daysToHoliday: null,
  })
    .filter((a) => a.tone === "danger" || a.tone === "warning")
    .slice(0, 3);

  const pctRef = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced);
      if (pctRef.current && attendanceState === "ready") {
        countTo(pctRef.current, overallPct, reduced, (n) => n.toFixed(1));
      }
    },
    [overallPct, attendanceState, upNext?.id],
  );

  return (
    <AppShell eyebrow={prettyDate(todayISO())} title={`Hi, ${displayName}`}>
      <div ref={scope} className="flex flex-1 flex-col">
        {holiday ? (
          <section data-reveal className="pb-9">
            <Label tone="accent">Holiday</Label>
            <h2 className="mt-3 text-hero">No classes today.</h2>
            <p className="mt-3 text-body text-text-2">
              {holiday.event?.replace(/ - Holiday$/i, "") ?? "Enjoy it."}
              {focus?.dayOrder != null && (
                <>
                  {" "}
                  Back on day order {focus.dayOrder}, {prettyDate(focus.date)}.
                </>
              )}
            </p>
          </section>
        ) : upNext ? (
          <section data-reveal className="pb-9">
            <div className="flex items-baseline justify-between gap-3">
              <Label tone="accent">
                {isToday ? "Up next" : `Next class, ${focus?.weekday ?? ""}`}
              </Label>
              <span className="tnum text-callout text-text-3">
                {focus?.dayOrder != null && `Day order ${focus.dayOrder}`}
              </span>
            </div>
            <h2 className="mt-3 text-balance text-hero">{upNext.title}</h2>
            <p className="mt-3 tnum text-body text-text-2">
              {upNext.start} to {upNext.end}
              {upNext.room ? ` · ${upNext.room}` : ""}
            </p>
          </section>
        ) : (
          <section data-reveal className="pb-9">
            <Label>Nothing scheduled</Label>
            <h2 className="mt-3 text-hero">You are free.</h2>
          </section>
        )}

        {/* Attendance status: one number, one verdict, one tap through. */}
        <Link
          href="/attendance"
          data-reveal
          className="mb-3 flex items-end justify-between rounded-card border border-line-soft bg-ink-1 px-5 py-4 transition-colors hover:bg-ink-2"
        >
          <div>
            <Label>Attendance</Label>
            <p className="mt-2 flex items-baseline gap-1.5">
              {attendanceState === "ready" ? (
                <>
                  <span ref={pctRef} className="tnum text-title">
                    {overallPct.toFixed(1)}
                  </span>
                  <span className="text-headline text-text-3">%</span>
                </>
              ) : (
                <span className="text-headline text-text-3">
                  {attendanceState === "gated" ? "Not published yet" : "Unavailable"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {attendanceState === "ready" &&
              (atRisk > 0 ? (
                <Chip tone="risk">
                  {atRisk} below {THRESHOLD}%
                </Chip>
              ) : (
                <Chip tone="safe">All safe</Chip>
              ))}
            <IconChevronRight size={18} className="text-text-3" />
          </div>
        </Link>

        {/* The day, as an agenda rather than a strip of chips. */}
        {remaining.length > 0 && (
          <Card data-reveal flush className="mb-3 overflow-hidden" as="section">
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <Label>{isToday ? "Rest of today" : prettyDate(focus?.date ?? "")}</Label>
              <span className="tnum text-callout text-text-3">
                {remaining.length} {remaining.length === 1 ? "class" : "classes"}
              </span>
            </div>
            <ul>
              {remaining.map((c, i) => (
                <li key={c.id}>
                  {i > 0 && <Divider inset={20} />}
                  <ClassLine item={c} first={i === 0 && isToday} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {alerts.length > 0 && (
          <Card data-reveal flush className="overflow-hidden" as="section">
            <div className="px-5 pb-1 pt-4">
              <Label>Needs attention</Label>
            </div>
            <ul>
              {alerts.map((a, i) => (
                <li key={a.id}>
                  {i > 0 && <Divider inset={20} />}
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      aria-hidden
                      className={`mt-2 size-1.5 shrink-0 rounded-full ${
                        a.tone === "danger" ? "bg-risk" : "bg-watch"
                      }`}
                    />
                    <p className="text-body text-text-2">{a.title}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function ClassLine({ item, first }: { item: ScheduleItem; first: boolean }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <span
        className={`tnum w-[46px] shrink-0 text-callout ${
          first ? "text-accent" : "text-text-3"
        }`}
      >
        {item.start}
      </span>
      <span className="min-w-0 flex-1 truncate text-headline">{item.abbrev}</span>
      <span className="shrink-0 text-callout text-text-3">
        {item.isCustom ? "Added" : (item.room ?? "")}
      </span>
    </div>
  );
}
