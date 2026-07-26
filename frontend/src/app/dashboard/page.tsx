"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import AppShell from "@/components/AppShell";
import Countdown from "@/components/Countdown";
import { useSession } from "@/context/SessionContext";
import {
  daySchedule,
  focusDay,
  holidayToday,
  nowMinutes,
  prettyDate,
  scheduleFor,
  mergeRuns,
  todayISO,
  type ScheduleItem,
} from "@/lib/schedule";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { IconChevronRight } from "@/components/Icons";
import { TrackRule } from "@/components/ui/editorial";

/**
 * HOME: a cover, not a dashboard.
 *
 * The screen is built as three beats rather than a stack of cards:
 *   1. The cover. A live countdown is the hero, set against the day-order
 *      numeral blown up and bled off the right edge.
 *   2. A full-bleed accent band carrying attendance, the one other number that
 *      changes a student's behaviour.
 *   3. The rest of the day, led by time rather than by course name, so the
 *      column of numerals gives the section its own rhythm.
 */
const THRESHOLD = 75;

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

  const cover = buildCover(classes, focus, holiday);
  const later = mergeRuns(
    cover.hero ? classes.slice(classes.indexOf(cover.hero) + 1) : classes,
  );

  const overall = attendance?.overallPercentage ?? 0;
  const belowTarget =
    attendance?.subjects.filter((s) => s.conducted > 0 && !s.isSafe).length ?? 0;

  const pct = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLDivElement>(null);

  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 18, stagger: 0.08 });
      if (pct.current && attendanceState === "ready") {
        countTo(pct.current, overall, reduced, (n) => n.toFixed(1));
      }
      // The day-order numeral drifts as the page moves under it, so the cover
      // has depth without any shadow or gradient.
      if (ghost.current && !reduced) {
        gsap.to(ghost.current, {
          yPercent: -14,
          ease: "none",
          scrollTrigger: { trigger: self, start: "top top", end: "+=420", scrub: 0.5 },
        });
      }
    },
    [overall, attendanceState, cover.hero?.id, cover.targetMs],
  );

  return (
    <AppShell section={prettyDate(todayISO())}>
      <div ref={scope} className="flex flex-1 flex-col">
        {/* ---------- 1. THE COVER ---------- */}
        <section className="bleed bleed-pad relative flex min-h-[74vh] flex-col justify-end overflow-hidden pb-10 pt-2">
          {focus?.dayOrder != null && (
            <div
              ref={ghost}
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-8 select-none text-right"
            >
              <span className="block text-[15rem] font-bold leading-[0.76] tracking-[-0.07em] text-ink-2">
                {String(focus.dayOrder).padStart(2, "0")}
              </span>
              {/* The numeral is the day order, so it says so. Unlabelled it would
                  be ornament, and ornament is what we are avoiding. */}
              <span className="mr-12 mt-2 block text-label uppercase text-text-3/60">
                Day order
              </span>
            </div>
          )}

          <div className="relative">
            <p data-reveal className="text-label uppercase text-accent">
              {cover.label}
            </p>

            <div className="mt-4">
              {cover.targetMs !== null ? (
                <Countdown key={cover.targetMs} target={cover.targetMs} />
              ) : (
                <p className="text-poster">&mdash;</p>
              )}
            </div>

            <div data-reveal className="mt-9 h-px w-full bg-line" />

            <h1 data-reveal className="mt-6 text-balance text-title">
              {cover.title}
            </h1>
            <p data-reveal className="mt-2.5 tnum text-callout text-text-3">
              {cover.meta}
            </p>
            {cover.note && (
              <p data-reveal className="mt-1.5 text-callout text-accent">
                {cover.note}
              </p>
            )}
          </div>
        </section>

        {/* ---------- 2. THE MEASURE ---------- */}
        <Link href="/attendance" data-reveal className="group block pt-9">
          <div className="flex items-baseline justify-between">
            <span className="text-label uppercase text-text-3">Attendance</span>
            <span className="flex items-center gap-1.5 text-label uppercase text-text-3 transition-colors group-hover:text-text-1">
              All subjects
              <IconChevronRight size={14} />
            </span>
          </div>

          {attendanceState === "ready" ? (
            <>
              <div className="mt-5 flex items-end justify-between gap-4">
                <span className="flex items-baseline">
                  <span ref={pct} className="tnum text-display">
                    {overall.toFixed(1)}
                  </span>
                  <span className="text-title text-text-3">%</span>
                </span>
                <span className="pb-2 text-callout text-text-3">
                  {belowTarget > 0 ? (
                    <span className="text-accent">
                      {belowTarget} below target
                    </span>
                  ) : (
                    "Every subject clear"
                  )}
                </span>
              </div>
              {/* The 75% mark is a tick on the rule, so the gap between where you
                  are and where you must be is a distance, not a number. */}
              <TrackRule
                value={overall}
                threshold={THRESHOLD}
                tone={overall < THRESHOLD ? "accent" : "neutral"}
                className="bleed mt-6"
              />
            </>
          ) : (
            <p className="mt-5 text-title text-text-3">
              {attendanceState === "gated" ? "Not published yet" : "Unavailable"}
            </p>
          )}
        </Link>

        {/* ---------- 3. THE REST OF THE DAY ---------- */}
        {later.length > 0 && (
          <section className="pt-12">
            <div data-reveal className="flex items-baseline justify-between">
              <h2 className="text-label uppercase text-text-3">
                {cover.thenLabel}
              </h2>
              <span className="tnum text-label uppercase text-text-3">
                {later.length} more
              </span>
            </div>
            <ul className="mt-7 flex flex-col gap-7">
              {later.map((c) => (
                <li key={c.id} data-reveal className="flex items-baseline gap-5">
                  <span className="tnum w-[74px] shrink-0 text-title text-text-1">
                    {c.start}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-2">
                      {c.title}
                    </span>
                    <span className="mt-1 block truncate text-callout text-text-3">
                      {[
                        c.abbrev,
                        `until ${c.end}`,
                        c.isCustom ? "Added" : c.room,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

type Cover = {
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
function buildCover(
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
    meta: [
      prettyDate(focus.date),
      `${first.start} to ${first.end}`,
      first.room,
    ]
      .filter(Boolean)
      .join(" · "),
    targetMs: at(focus.date, first.startMin),
    hero: first,
    thenLabel: `Rest of ${focus.weekday}`,
    note: holiday
      ? `Today is ${holiday.event?.replace(/ - Holiday$/i, "") ?? "a holiday"}`
      : null,
  };
}
