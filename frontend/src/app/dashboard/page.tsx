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
import { countTo, revealIn, revealRows, useGsap } from "@/lib/motion";
import { Rule, SectionHead, Marginalia } from "@/components/ui/editorial";

/**
 * Home reads like the front page: a dateline, one large statement of what is
 * next, then the day as a plain indexed list. No cards, so the type carries
 * everything.
 */
export default function DashboardPage() {
  const {
    timetable,
    attendance,
    attendanceState,
    customClasses,
    optionalCourses,
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
  const later = upNext ? classes.slice(classes.indexOf(upNext) + 1) : classes;

  const overall = attendance?.overallPercentage ?? 0;
  const atRisk =
    attendance?.subjects.filter((s) => s.conducted > 0 && !s.isSafe).length ?? 0;

  const alerts = buildAlerts({
    attendance,
    attendanceReady: attendanceState === "ready",
    threshold: attendance?.threshold,
    nextClass: null,
    nextClassLabel: "today",
    holiday: null,
    daysToHoliday: null,
  })
    .filter((a) => a.tone === "danger")
    .slice(0, 2);

  const pct = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { selector: "[data-reveal]", y: 16, stagger: 0.07 });
      revealRows(self, reduced);
      if (pct.current && attendanceState === "ready") {
        countTo(pct.current, overall, reduced, (n) => n.toFixed(1));
      }
    },
    [overall, attendanceState, upNext?.id],
  );

  return (
    <AppShell section="Skipp">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* Dateline */}
        <div data-reveal className="pt-1">
          <span className="text-label uppercase text-text-3">
            {prettyDate(todayISO())}
          </span>
        </div>

        {/* The statement */}
        <section data-reveal className="pb-10 pt-7">
          {holiday ? (
            <>
              <h1 className="text-hero text-balance">No classes today.</h1>
              <Marginalia>
                <span className="mt-5 block">
                  {holiday.event?.replace(/ - Holiday$/i, "") ?? "A holiday."}
                  {focus?.dayOrder != null && (
                    <>
                      {" "}
                      Back on {prettyDate(focus.date)}, day order {focus.dayOrder}.
                    </>
                  )}
                </span>
              </Marginalia>
            </>
          ) : upNext ? (
            <>
              <p className="text-label uppercase text-accent">
                {isToday ? "Up next" : `Next, ${focus?.weekday}`}
              </p>
              <h1 className="mt-4 text-balance text-hero">{upNext.title}</h1>
              <p className="tnum mt-5 text-title text-text-2">
                {upNext.start}
                <span className="text-text-3"> to {upNext.end}</span>
              </p>
              {(upNext.room || focus?.dayOrder != null) && (
                <p className="mt-2 text-callout text-text-3">
                  {[upNext.room, focus?.dayOrder != null && `Day order ${focus.dayOrder}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-hero">Nothing scheduled.</h1>
              <Marginalia>
                <span className="mt-5 block">Your term calendar is clear today.</span>
              </Marginalia>
            </>
          )}
        </section>

        {/* The day, as an indexed list */}
        {later.length > 0 && (
          <section className="pb-10">
            <SectionHead
              aside={`${later.length} more`}
            >
              {isToday ? "Then" : prettyDate(focus?.date ?? "")}
            </SectionHead>
            <ul className="mt-1">
              {later.map((c, i) => (
                <li key={c.id} data-row>
                  <Rule soft={i > 0} />
                  <ClassLine item={c} index={i + 2} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Attendance, stated once, as a line of type */}
        <Link href="/attendance" data-row className="group block pb-10">
          <SectionHead aside={atRisk > 0 ? `${atRisk} below target` : undefined}>
            Attendance
          </SectionHead>
          <div className="mt-5 flex items-end justify-between gap-4">
            {attendanceState === "ready" ? (
              <span className="flex items-baseline gap-1">
                <span ref={pct} className="tnum text-display">
                  {overall.toFixed(1)}
                </span>
                <span className="text-title text-text-3">%</span>
              </span>
            ) : (
              <span className="text-title text-text-3">
                {attendanceState === "gated" ? "Not published" : "Unavailable"}
              </span>
            )}
            <span className="pb-3 text-callout text-text-3 transition-colors group-hover:text-text-1">
              View
            </span>
          </div>
          {alerts.length > 0 && (
            <p className="mt-4 text-callout text-accent">{alerts[0].title}</p>
          )}
        </Link>
      </div>
    </AppShell>
  );
}

function ClassLine({ item, index }: { item: ScheduleItem; index: number }) {
  return (
    <div className="flex items-baseline gap-4 py-4">
      <span className="tnum w-8 shrink-0 text-label text-text-3">
        {String(index).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-headline">{item.title}</span>
          <span className="tnum shrink-0 text-callout text-text-2">{item.start}</span>
        </div>
        <p className="mt-1 truncate text-callout text-text-3">
          {[item.abbrev, item.isCustom ? "Added" : item.room].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}
