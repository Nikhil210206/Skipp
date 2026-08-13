"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import { revealIn, useGsap } from "@/lib/motion";
import { Button, IconButton, StateView } from "@/components/ui";
import { Marginalia, Rule, SectionHead, TrackRule } from "@/components/ui/editorial";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import HolidaysSheet from "@/components/HolidaysSheet";
import HolidayRow from "@/components/HolidayRow";
import {
  MONTH_NAMES as MONTHS,
  dayAndDate,
  daysAway,
  fullWeekday,
  holidayName,
  shortDate,
  termHolidays,
} from "@/lib/holidays";
import type { CalendarDay } from "@/types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The term as one full-bleed grid. The selected day is written out above it in
 * words rather than boxed in a card, so the grid itself is the whole screen.
 */
export default function CalendarPage() {
  const { timetable } = useSession();
  const cal = useMemo(() => timetable?.calendar ?? [], [timetable]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    cal.forEach((d) => m.set(d.date, d));
    return m;
  }, [cal]);

  const months = useMemo(() => {
    const set = new Set<string>();
    cal.forEach((d) => set.add(d.date.slice(0, 7)));
    return [...set].sort();
  }, [cal]);

  const today = todayISO();
  const [ym, setYm] = useState(
    () => months.find((m) => m === today.slice(0, 7)) ?? months[0] ?? today.slice(0, 7),
  );
  const [selected, setSelected] = useState(
    () => (byDate.has(today) ? today : months[0] ? `${months[0]}-01` : today),
  );

  const holidays = useMemo(() => termHolidays(cal, today), [cal, today]);
  const [allOpen, setAllOpen] = useState(false);

  const scope = useGsap(({ self, reduced }) => revealIn(self, reduced, { y: 12 }), [ym]);

  if (cal.length === 0) {
    return (
      <AppShell section="Calendar">
        <StateView
          title="Calendar unavailable"
          message="The academic planner did not load. Pull down to try again."
        />
      </AppShell>
    );
  }

  const [year, month0] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1];
  const monthIdx = months.indexOf(ym);
  const sel = byDate.get(selected);
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const working = cells.filter(
    (d) => d !== null && byDate.get(iso(d))?.dayOrder != null,
  ).length;
  // Scoped to the month on screen, because that is the question the month rail
  // has just been used to ask. The whole term is one tap away in the sheet.
  const thisMonth = holidays.filter((h) => h.date.slice(0, 7) === ym);
  const monthHasHoliday = thisMonth.length > 0;
  // For a month with none, the useful answer is not "none", it is when.
  const nextUp = holidays.find((h) => !h.past && h.date.slice(0, 7) > ym)
    ?? holidays.find((h) => !h.past);

  // How far through the term we are, counted in working days rather than dates,
  // because only working days cost attendance.
  const workingAll = cal.filter((d) => d.dayOrder != null);
  const workingDone = workingAll.filter((d) => d.date < today).length;
  const termPct = workingAll.length > 0 ? (workingDone / workingAll.length) * 100 : 0;

  return (
    <AppShell section="Calendar">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* The term as one measurement */}
        <div data-reveal className="pb-9 pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-label uppercase text-text-3">Term progress</p>
            <p className="tnum text-label uppercase text-text-3">
              {workingAll.length - workingDone} working days left
            </p>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tnum text-title">{termPct.toFixed(0)}</span>
            <span className="text-callout text-text-3">%</span>
          </div>
          <TrackRule value={termPct} className="bleed mt-4" />
          <Marginalia>
            <span className="mt-4 block tnum">
              {workingDone} of {workingAll.length} working days behind you
            </span>
          </Marginalia>
        </div>

        {/* The selected day, written out */}
        <div data-reveal className="pb-8">
          <p className="text-label uppercase text-text-3">
            {sel ? fullWeekday(sel.weekday) : "Term"} · {shortDate(selected)}
          </p>
          {/* On a holiday the NAME leads and "Holiday" becomes the supporting
              line. "Holiday" is a category, and the dot in the grid has already
              told you that much; WHICH holiday it is, is the thing you tapped
              the square to find out. */}
          <h1 className="mt-3 text-balance text-title">
            {sel?.isHoliday && sel.event
              ? holidayName(sel.event)
              : sel?.dayOrder != null
                ? `Day order ${sel.dayOrder}`
                : sel?.isHoliday
                  ? "Holiday"
                  : "No classes"}
          </h1>
          {sel?.isHoliday && sel.event ? (
            <p className="mt-2 text-callout uppercase tracking-[0.075em] text-accent">
              Holiday
            </p>
          ) : (
            sel?.event && (
              <Marginalia>
                <span className="mt-3 block">{holidayName(sel.event)}</span>
              </Marginalia>
            )
          )}
        </div>

        {/* Month rail */}
        <div data-reveal className="flex items-end justify-between gap-4 pb-6">
          <h2 className="optical text-poster leading-[0.78]">
            {MONTHS[month0].slice(0, 3)}
            <span className="tnum block text-title text-text-3">{year}</span>
          </h2>
          <div className="-mr-2 flex">
            <IconButton
              label="Previous month"
              variant="quiet"
              disabled={monthIdx <= 0}
              onClick={() => monthIdx > 0 && setYm(months[monthIdx - 1])}
            >
              <IconChevronLeft size={18} />
            </IconButton>
            <IconButton
              label="Next month"
              variant="quiet"
              disabled={monthIdx >= months.length - 1}
              onClick={() => monthIdx < months.length - 1 && setYm(months[monthIdx + 1])}
            >
              <IconChevronRight size={18} />
            </IconButton>
          </div>
        </div>

        {/* Full-bleed grid */}
        <div data-reveal className="bleed bleed-pad">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className="pb-4 text-center text-label uppercase text-text-3/70"
              >
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const date = iso(d);
              const day = byDate.get(date);
              const isSel = date === selected;
              const isToday = date === today;
              const works = day?.dayOrder != null;
              const holiday = Boolean(day?.isHoliday);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(date)}
                  aria-pressed={isSel}
                  aria-label={`${d} ${MONTHS[month0]}${
                    works
                      ? `, day order ${day!.dayOrder}`
                      : holiday
                        ? `, holiday${day?.event ? `, ${holidayName(day.event)}` : ""}`
                        : ""
                  }`}
                  data-day
                  // The day order as a marker as well as a numeral, so a theme
                  // can colour it. Stone gives each day order one of its
                  // four, which makes a day order recognisable here and on
                  // Schedule without reading the figure.
                  data-do={day?.dayOrder ?? undefined}
                  // Taller past `lg`. Once the grid fills a laptop window each
                  // cell is ~150px wide, and at the phone's 52px height that is
                  // a 3:1 letterbox rather than a day. Height only, so the
                  // phone grid is untouched.
                  className="relative flex h-[52px] flex-col items-center justify-center lg:h-[84px]"
                >
                  <span
                    className={`tnum relative text-body transition-colors ${
                      isSel
                        ? "font-semibold text-accent"
                        : works
                          ? "text-text-1"
                          : holiday
                            ? // Brighter than a weekend, dimmer than a working
                              // day. A holiday is not a dead square: it is the
                              // one kind of empty day worth going looking for.
                              "text-text-2"
                            : "text-text-3/45"
                    }`}
                  >
                    {d}
                  </span>
                  {/* One slot, three states: a working day shows its day order,
                      a holiday shows an accent dot, an ordinary empty day shows
                      nothing. Before this a holiday was indistinguishable from a
                      Sunday, since neither carries a day order. */}
                  <span className="tnum relative mt-1 flex h-2 items-center justify-center text-[9px] font-semibold leading-none text-text-3/70">
                    {works ? (
                      day!.dayOrder
                    ) : holiday ? (
                      <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                    ) : null}
                  </span>
                  {isToday && (
                    <span className="absolute bottom-1.5 h-px w-5 bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div data-reveal className="pt-6">
          <Marginalia>
            <span className="tnum">{working} working days</span> · small figures are day
            orders
            {monthHasHoliday && ", a dot is a holiday"}
          </Marginalia>
        </div>

        {/* Days off in the month on screen. The section is always here, in
            every month, because a month with nothing is exactly when a student
            wants to know where the next break is, and because the way through
            to the whole term must never disappear with the list. */}
        <section data-reveal className="pt-10">
          <SectionHead
            aside={
              thisMonth.length > 0
                ? `${thisMonth.length} in ${MONTHS[month0].slice(0, 3)}`
                : `none in ${MONTHS[month0].slice(0, 3)}`
            }
          >
            Days off
          </SectionHead>

          {thisMonth.length > 0 ? (
            <ul className="mt-1">
              {thisMonth.map((h, i) => (
                <li key={h.date}>
                  <Rule soft={i > 0} />
                  <HolidayRow
                    h={h}
                    today={today}
                    selected={selected === h.date}
                    onClick={() => setSelected(h.date)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="pt-4">
              <Rule soft />
              <p className="pt-4 text-body leading-relaxed text-text-2">
                No days off in {MONTHS[month0]}.
                {nextUp && (
                  <>
                    {" "}
                    Next is{" "}
                    <span className="text-text-1">{nextUp.name}</span>,{" "}
                    <span className="tnum">
                      {dayAndDate(nextUp.weekday, nextUp.date)}
                    </span>
                    , {daysAway(today, nextUp.date)}.
                  </>
                )}
              </p>
              {!nextUp && (
                <Marginalia>
                  <span className="mt-2 block">
                    No days off left this term.
                  </span>
                </Marginalia>
              )}
            </div>
          )}

          {holidays.length > 0 && (
            <Button
              variant="secondary"
              full
              className="mt-5"
              onClick={() => setAllOpen(true)}
            >
              See all days off
            </Button>
          )}
        </section>
      </div>

      <HolidaysSheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        holidays={holidays}
        today={today}
        onPick={(date) => {
          setYm(date.slice(0, 7));
          setSelected(date);
        }}
      />
    </AppShell>
  );
}
